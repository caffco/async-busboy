import type { IncomingMessage } from 'http';
import type { BusboyConfig, BusboyEvents } from 'busboy';
import Busboy from 'busboy';
import type { Readable } from 'stream';
import fs, { ReadStream } from 'fs';
import os from 'os';
import path from 'path';

const getDescriptor = Object.getOwnPropertyDescriptor;

export interface ErrorWithCodeAndStatus extends Error {
  code: string;
  status: number;
}

interface AsyncBusboyConfig extends BusboyConfig {
  onFile?: BusboyEvents['file'];
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

  const customOnFile = options.onFile ?? false;

  const busboy = Busboy(options);

  return new Promise<{
    fields: Record<string, string | Array<string>>;
    files: Array<ReadStreamWithMetadata>;
  }>((resolve, reject) => {
    const fields: Record<string, string | Array<string>> = {};
    const filePromises: Array<ReadStreamWithMetadata> = [];

    const onError = (err: Error): void => {
      cleanup();
      return reject(err);
    };

    const onEnd = (err?: Error): void => {
      if (err) {
        return reject(err);
      }

      if (customOnFile) {
        cleanup();
        return resolve({ fields, files: [] });
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
      busboy.removeListener('file', customOnFile || onFile);
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
      .on('field', onField.bind(null, fields))
      .on('file', customOnFile || onFile.bind(null, filePromises))
      .on('error', onError)
      .on('end', onEnd)
      .on('close', onEnd)
      .on('finish', onEnd);

    busboy.on('partsLimit', () => {
      const err = new Error(
        'Reach parts limit',
      ) as unknown as ErrorWithCodeAndStatus;
      err.code = 'Request_parts_limit';
      err.status = 413;
      onError(err);
    });

    busboy.on('filesLimit', () => {
      const err = new Error(
        'Reach files limit',
      ) as unknown as ErrorWithCodeAndStatus;
      err.code = 'Request_files_limit';
      err.status = 413;
      onError(err);
    });

    busboy.on('fieldsLimit', () => {
      const err = new Error(
        'Reach fields limit',
      ) as unknown as ErrorWithCodeAndStatus;
      err.code = 'Request_fields_limit';
      err.status = 413;
      onError(err);
    });

    request.pipe(busboy);
  });
}

const onField = (
  fields: Record<string, string | Array<string>>,
  name: Parameters<BusboyEvents['field']>[0],
  val: Parameters<BusboyEvents['field']>[1],
  info: Parameters<BusboyEvents['field']>[2],
): ReturnType<BusboyEvents['field']> => {
  // Don't overwrite prototypes
  if (getDescriptor(Object.prototype, name)) {
    return;
  }

  // This looks like a stringified array, let's parse it
  if (name.indexOf('[') > -1) {
    const obj = objectFromBluePrint(getKeyPaths(name), val);
    reconcile(obj, fields);
    return;
  }

  if (!fields.hasOwnProperty(name)) {
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

interface ReadStreamWithMetadata extends ReadStream {
  fieldname: string;
  filename: string;
  transferEncoding: string;
  encoding: string;
  mimeType: string;
  mime: string;
}

const onFile = (
  filePromises: Array<Promise<ReadStreamWithMetadata>>,
  fieldname: Parameters<BusboyEvents['file']>[0],
  file: Parameters<BusboyEvents['file']>[1] & {
    tmpName: string;
  },
  info: Parameters<BusboyEvents['file']>[2],
) => {
  const tmpName = Math.random().toString(16).substring(2) + '-' + info.filename;
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
const objectFromBluePrint = <T>(arr: Array<string>, value: T): Object =>
  arr.reduceRight<Object>((acc, next) => {
    if (Number(next).toString() === 'NaN') {
      return { [next]: acc };
    }

    const newAcc = [];
    newAcc[Number(next)] = acc;
    return newAcc;
  }, value);

/**
 * Merge formatted data with already formatted data
 *
 * @note This function modifies `target`
 * @param obj Object to be merged into `target`
 * @param target The field object that will be modified
 */
const reconcile = (obj: Object, target: Object): void => {
  const [[key, val]] = Object.entries(obj);

  if (target.hasOwnProperty(key)) {
    reconcile(val, target[key]);
  } else {
    target[key] = val;
  }
};
