import { simpleText } from './tools';

/* Delete redundant text in markdown */
// COMT: 删除markdown中的冗余文本
export const simpleMarkdownText = (rawText: string) => {
  rawText = simpleText(rawText);

  // Remove a line feed from a hyperlink or picture
  // 删除超链接或图片中的换行符
  rawText = rawText.replace(/\[([^\]]+)\]\((.+?)\)/g, (match, linkText, url) => {
    const cleanedLinkText = linkText.replace(/\n/g, ' ').trim();

    if (!url) {
      return '';
    }

    return `[${cleanedLinkText}](${url})`;
  });

  // replace special #\.* ……
  const reg1 = /\\([#`!*()+-_\[\]{}\\.])/g;
  if (reg1.test(rawText)) {
    rawText = rawText.replace(reg1, '$1');
  }

  // replace \\n
  rawText = rawText.replace(/\\\\n/g, '\\n');

  // Remove headings and code blocks front spaces
  ['####', '###', '##', '#', '```', '~~~'].forEach((item, i) => {
    const reg = new RegExp(`\\n\\s*${item}`, 'g');
    if (reg.test(rawText)) {
      rawText = rawText.replace(new RegExp(`(\\n)( *)(${item})`, 'g'), '$1$3');
    }
  });

  return rawText.trim();
};

/**
 * format markdown
 * 1. upload base64
 * 2. replace \
 */
// COMT: 看起来是将markdown格式的文本中的图片（base64文本）上传，并替换链接
export const uploadMarkdownBase64 = async ({
  rawText,
  uploadImgController
}: {
  rawText: string;
  uploadImgController?: (base64: string) => Promise<string>;
}) => {
  if (uploadImgController) { // 如果有上传图片的函数
    // match base64, upload and replace it
    const base64Regex = /data:image\/.*;base64,([^\)]+)/g; // 匹配base64的正则
    const base64Arr = rawText.match(base64Regex) || []; // 匹配到的base64数组

    // upload base64 and replace it
    for await (const base64Img of base64Arr) {
      try {
        const str = await uploadImgController(base64Img); // 上传图片

        rawText = rawText.replace(base64Img, str);
      } catch (error) {
        rawText = rawText.replace(base64Img, '');// 就算出错也要替换掉，不然会吃上下文
        rawText = rawText.replace(/!\[.*\]\(\)/g, ''); // 删除空的图片markdown标签
      }
    }
  }

  // Remove white space on both sides of the picture
  // 删除图片两边的空白
  const trimReg = /(!\[.*\]\(.*\))\s*/g; 
  if (trimReg.test(rawText)) {
    rawText = rawText.replace(trimReg, '$1');
  }

  return rawText;
};
// COMT: 将markdown格式文本处理函数，保存图片就是在这里做的
export const markdownProcess = async ({
  rawText,
  uploadImgController
}: {
  rawText: string;
  uploadImgController?: (base64: string) => Promise<string>;
}) => {
  const imageProcess = await uploadMarkdownBase64({
    rawText,
    uploadImgController
  });

  return simpleMarkdownText(imageProcess);
};
