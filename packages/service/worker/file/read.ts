import { parentPort } from 'worker_threads';
import { readFileRawText } from './extension/rawText';
import { ReadRawTextByBuffer, ReadRawTextProps } from './type';
import { readHtmlRawText } from './extension/html';
import { readPdfFile } from './extension/pdf';
import { readDocsFile } from './extension/docx';
import { readPptxRawText } from './extension/pptx';
import { readXlsxRawText } from './extension/xlsx';
import { readCsvRawText } from './extension/csv';

// COMT: 这里使用了worker_threads，在worker_threads中，parentPort是一个MessagePort实例，它允许你与父线程通信
// COMT: 读取文件中文本的方法，根据文件后缀调用不同的读取
parentPort?.on('message', async (props: ReadRawTextProps<Uint8Array>) => {
  const readRawContentByFileBuffer = async (params: ReadRawTextByBuffer) => {
    switch (params.extension) {
      case 'txt':
      case 'md':
        return readFileRawText(params);
      case 'html':
        return readHtmlRawText(params);
      case 'pdf':
        return readPdfFile(params);
      case 'docx':
        return readDocsFile(params);
      case 'pptx':
        return readPptxRawText(params);
      case 'xlsx':
        return readXlsxRawText(params);
      case 'csv':
        return readCsvRawText(params);
      default:
        return Promise.reject('Only support .txt, .md, .html, .pdf, .docx, pptx, .csv, .xlsx');
    }
  };

  //   params.buffer: Uint8Array -> buffer
  const buffer = Buffer.from(props.buffer);
  const newProps: ReadRawTextByBuffer = {
    ...props,
    buffer
  };

  try {
    parentPort?.postMessage({
      type: 'success',
      data: await readRawContentByFileBuffer(newProps)
    });
  } catch (error) {
    console.log(error);
    parentPort?.postMessage({
      type: 'error',
      data: error
    });
  }

  process.exit();
});
