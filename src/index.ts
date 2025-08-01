import type { BusboyConfig, BusboyEvents } from 'busboy';
import Busboy from 'busboy';
import fs, { ReadStream } from 'fs';
import type { IncomingMessage } from 'http';
import os from 'os';
import path from 'path';

export interface ErrorWithCodeAndStatus extends Error {
  code: string;
  status: number;
}

interface AsyncBusboyConfig extends BusboyConfig {
  onFile?: BusboyEvents['file'];
}

interface ReadStreamWithMetadata extends ReadStream {
  fieldname: string;
  filename: string;
  transferEncoding: string;
  encoding: string;
  mimeType: string;
  mime: string;
}

export default function (
  request: IncomingMessage,
  overridenOptions: Partial<AsyncBusboyConfig> = {},
) {
  const options: AsyncBusboyConfig = {
    ...overridenOptions,
    headers: {
      'content-type': '',
      ...request.headers,
      ...overridenOptions.headers,
    },
  };

  const busboy = Busboy(options);

  return new Promise<{
    fields: Record<string, string | Array<string>>;
    files: Array<ReadStreamWithMetadata>;
  }>((resolve, reject) => {
    const fields: Record<string, string | Array<string>> = {};
    const filePromises: Array<Promise<ReadStreamWithMetadata>> = [];

    const onField = onFieldFactory(fields);
    const onFile = options.onFile ?? onFileFactory(filePromises);

    const onError = (err: Error): void => {
      cleanup();
      reject(err);
    };

    const onEnd = (err?: Error): void => {
      if (err) {
        reject(err);
        return;
      }

      Promise.all(filePromises)
        .then((files) => {
          cleanup();
          resolve({ fields, files });
        })
        .catch(reject);
    };

    const cleanup = () => {
      busboy.removeListener('field', onField);
      busboy.removeListener('file', onFile);
      busboy.removeListener('close', cleanup);
      busboy.removeListener('end', cleanup);
      busboy.removeListener('error', onEnd);
      busboy.removeListener('partsLimit', onEnd);
      busboy.removeListener('filesLimit', onEnd);
      busboy.removeListener('fieldsLimit', onEnd);
      busboy.removeListener('finish', onEnd);
    };

    request.on('close', cleanup);

    busboy
      .on('field', onField)
      .on('file', onFile)
      .on('error', onError)
      .on('end', onEnd)
      .on('close', onEnd)
      .on('finish', onEnd)
      .on('partsLimit', () =>
        onError(
          createError({
            message: 'Reach parts limit',
            code: 'Request_parts_limit',
          }),
        ),
      )
      .on('filesLimit', () =>
        onError(
          createError({
            message: 'Reach files limit',
            code: 'Request_files_limit',
          }),
        ),
      )
      .on('fieldsLimit', () =>
        onError(
          createError({
            message: 'Reach fields limit',
            code: 'Request_fields_limit',
          }),
        ),
      );

    request.pipe(busboy);
  });
}

const hasOwnProp = <T extends object>(target: T, propertyName: string) =>
  Object.hasOwn(target, propertyName);

const onFieldFactory =
  (fields: Record<string, string | Array<string>>): BusboyEvents['field'] =>
  (name, val) => {
    // Don't overwrite prototypes
    if (hasOwnProp(Object.prototype, name)) {
      return;
    }

    // This looks like a stringified array, let's parse it
    if (name.indexOf('[') > -1) {
      const obj = objectFromBluePrint(getKeyPaths(name), val);
      reconcile(obj, fields);
      return;
    }

    if (!hasOwnProp(fields, name)) {
      fields[name] = val;
      return;
    }

    if (Array.isArray(fields[name])) {
      (fields[name] as Array<Parameters<BusboyEvents['field']>[0]>).push(val);
    } else {
      (fields[name] as Array<Parameters<BusboyEvents['field']>[0]>) = [
        fields[name] as Parameters<BusboyEvents['field']>[0],
        val,
      ];
    }
  };

const onFileFactory =
  (
    filePromises: Array<Promise<ReadStreamWithMetadata>>,
  ): BusboyEvents['file'] =>
  (
    fieldname,
    file: Parameters<BusboyEvents['file']>[1] & {
      tmpName: string;
    },
    info,
  ) => {
    const tmpName =
      Math.random().toString(16).substring(2) + '-' + info.filename;
    file.tmpName = tmpName;
    const saveTo = path.join(os.tmpdir(), path.basename(tmpName));
    const writeStream = fs.createWriteStream(saveTo);

    const filePromise = new Promise<ReadStreamWithMetadata>((resolve, reject) =>
      writeStream
        .on('open', () =>
          file
            .pipe(writeStream)
            .on('error', reject)
            .on('finish', () => {
              const readStream = fs.createReadStream(
                saveTo,
              ) as ReadStreamWithMetadata;
              readStream.fieldname = fieldname;
              readStream.filename = info.filename;
              readStream.transferEncoding = info.encoding;
              readStream.encoding = info.encoding;
              readStream.mimeType = info.mimeType;
              readStream.mime = info.mimeType;
              resolve(readStream);
            }),
        )
        .on('error', (err) => {
          file.resume().on('error', reject);
          reject(err);
        }),
    );
    filePromises.push(filePromise);
  };

const createError = ({
  message,
  code,
}: {
  message: string;
  code: string;
}): ErrorWithCodeAndStatus => {
  const err = new Error(message) as unknown as ErrorWithCodeAndStatus;
  err.code = code;
  err.status = 413;
  return err;
};

/**
 * Extract a hierarchy array from a stringified formData single input.
 *
 * @example topLevel[sub1][sub2] => [topLevel, sub1, sub2]
 * @param string Stringify representation of a formData Object
 */
const getKeyPaths = (keyPath: string): Array<string> => {
  const [head, ...tail] = keyPath.split('[');
  const keysInKeyPath = tail.map((v) => v.split(']')[0]);
  return [head, ...keysInKeyPath];
};

/**
 * Generate an object given an hierarchy blueprint and the value
 *
 * @example [key1, key2, key3] => { key1: {key2: { key3: value }}};
 * @param arr List of key paths, from `getKeyPaths`
 * @param value The actual value for this key path
 */
const objectFromBluePrint = <T>(arr: Array<string>, value: T): object =>
  arr.reduceRight<object>((acc, next) => {
    if (Number(next).toString() === 'NaN') {
      return { [next]: acc };
    }

    const newAcc = [];
    newAcc[Number(next)] = acc;
    return newAcc;
  }, value as object);

/**
 * Merge formatted data with already formatted data
 *
 * @note This function modifies `target`
 * @param obj Object to be merged into `target`
 * @param target The field object that will be modified
 */
const reconcile = (obj: object, target: object): void => {
  const [[key, val]] = Object.entries(obj);

  if (hasOwnProp(target, key)) {
    reconcile(val, target[key]);
  } else {
    target[key] = val;
  }
};
