import type { BusboyEvents } from 'busboy';
import { IncomingMessage } from 'http';
import Stream from 'stream';
import { describe, expect, it } from 'vitest';

import asyncBusboy from '.';

const fileContent = [
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
];

const multipartContent = [
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="file_name_0"',
  '',
  'super alpha file',
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="file_name_0"',
  '',
  'super beta file',
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="file_name_0"',
  '',
  'super gamma file',
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="file_name_1"',
  '',
  'super gamma file',
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="_csrf"',
  '',
  'ooxx',
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="hasOwnProperty"',
  '',
  'super bad file',

  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="someCollection[0][foo]"',
  '',
  'foo',
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="someCollection[0][bar]"',
  '',
  'bar',
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="someCollection[1][0]"',
  '',
  'foo',
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="someCollection[1][1]"',
  '',
  'bar',
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="someField[foo]"',
  '',
  'foo',
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="someField[bar]"',
  '',
  'bar',

  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="upload_file_0"; filename="1k_a.dat"',
  'Content-Type: application/octet-stream',
  '',
  fileContent[0],
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="upload_file_1"; filename="1k_b.dat"',
  'Content-Type: application/octet-stream',
  '',
  fileContent[1],
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  'Content-Disposition: form-data; name="upload_file_2"; filename="hack.exe"',
  'Content-Type: application/octet-stream',
  '',
  fileContent[2],
  '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k--',
].join('\r\n');

const request = () => {
  // https://github.com/mscdex/busboy/blob/master/test/test-types-multipart.js

  const stream = new Stream.PassThrough() as unknown as Stream.PassThrough &
    IncomingMessage;

  stream.headers = {
    'content-type':
      'multipart/form-data; boundary=---------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
  };

  stream.write(multipartContent);

  stream.end();

  return stream;
};

const readFileStreamPromise = (readStream: Stream.Readable) =>
  new Promise<string>((resolve, reject) => {
    const buffers = [];
    readStream.on('data', (buf) => buffers.push(buf));
    readStream.on('end', () => resolve(Buffer.concat(buffers).toString()));
    readStream.on('error', reject);
  });

describe('Async-busboy', () => {
  it('should gather all fields and streams', async () => {
    const formData = await asyncBusboy(request());

    expect(Object.keys(formData.files)).toHaveLength(3);
    expect(Object.keys(formData.fields)).toHaveLength(5);

    // Check file contents
    const fileContentPromises = formData.files.map(readFileStreamPromise);
    await expect(Promise.all(fileContentPromises)).resolves.toEqual(
      fileContent,
    );
  });

  it('should gather all fields and streams using custom file handler', async () => {
    const fileContentPromises = [];
    const onFileHandler: BusboyEvents['file'] = (fieldname, file) => {
      fileContentPromises.push(readFileStreamPromise(file));
    };

    const formData = await asyncBusboy(request(), { onFile: onFileHandler });

    expect(Object.keys(formData.fields)).toHaveLength(5);

    // Check file contents
    await Promise.all(fileContentPromises).then((contentBufs) => {
      contentBufs.forEach((content, index) =>
        expect(content.toString()).toBe(fileContent[index]),
      );
    });
  });

  it('should return a valid collection', async () => {
    const formData = await asyncBusboy(request());

    const someCollection = formData.fields.someCollection;
    expect(Array.isArray(someCollection)).toBe(true);
    expect(someCollection[0]).toEqual({ foo: 'foo', bar: 'bar' });
  });

  it('should return a valid array', async () => {
    const formData = await asyncBusboy(request());

    const fileName0 = formData.fields.file_name_0;
    expect(Array.isArray(fileName0)).toBe(true);
    expect(fileName0).toHaveLength(3);
    expect(fileName0[0]).toEqual('super alpha file');
    expect(fileName0[1]).toEqual('super beta file');
    expect(fileName0[2]).toEqual('super gamma file');
  });

  it('should not overwrite prototypes', async () => {
    const formData = await asyncBusboy(request());

    expect(formData.fields.hasOwnProperty).toEqual(
      Object.prototype.hasOwnProperty,
    );
  });

  it.each`
    limits           | code                      | message                 | description
    ${{ files: 1 }}  | ${'Request_files_limit'}  | ${'Reach files limit'}  | ${'when the files limit is reached'}
    ${{ fields: 1 }} | ${'Request_fields_limit'} | ${'Reach fields limit'} | ${'when the fields limit is reached'}
    ${{ parts: 1 }}  | ${'Request_parts_limit'}  | ${'Reach parts limit'}  | ${'when the parts limit is reached'}
  `('should throw error $description', async ({ limits, code, message }) => {
    await expect(
      asyncBusboy(request(), {
        limits,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 413,
        code,
        message,
      }),
    );
  });
});
