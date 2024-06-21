import { ReadRawTextByBuffer, ReadFileResponse } from '../type';
// import { parseOfficeAsync } from 'officeparser';
import { parseOffice } from '../parseOffice';

// COMT: 读取pptx文件的方法，输出为ReadFileResponse
export const readPptxRawText = async ({
  buffer,
  encoding
}: ReadRawTextByBuffer): Promise<ReadFileResponse> => {
  const result = await parseOffice({
    buffer,
    encoding: encoding as BufferEncoding,
    extension: 'pptx'
  });

  return {
    rawText: result
  };
};
