import { VectorModelItemType } from '@fastgpt/global/core/ai/model.d';
import { getAIApi } from '../config';
import { countPromptTokens } from '../../../common/string/tiktoken/index';
import { EmbeddingTypeEnm } from '@fastgpt/global/core/ai/constants';
import { addLog } from '../../../common/system/log';

type GetVectorProps = {
  model: VectorModelItemType;
  input: string;
  type?: `${EmbeddingTypeEnm}`;
};

// text to vector
// COMT: 从文本获取向量的最底层函数

export async function getVectorsByText({ model, input, type }: GetVectorProps) {
  if (!input) {// 如果输入为空
    return Promise.reject({
      code: 500,
      message: 'input is empty'
    });
  }

  try {
    const ai = getAIApi();

    // input text to vector
    // 从文本获取向量
    const result = await ai.embeddings
      .create({
        ...model.defaultConfig,
        ...(type === EmbeddingTypeEnm.db && model.dbConfig),
        ...(type === EmbeddingTypeEnm.query && model.queryConfig),
        model: model.model,
        input: [input]
      })
      .then(async (res) => {
        if (!res.data) {
          addLog.error('Embedding API is not responding', res);
          return Promise.reject('Embedding API is not responding');
        }
        if (!res?.data?.[0]?.embedding) {
          console.log(res);
          // @ts-ignore
          return Promise.reject(res.data?.err?.message || 'Embedding API Error');
        }

        const [tokens, vectors] = await Promise.all([
          countPromptTokens(input), // 计算token数量
          Promise.all(res.data.map((item) => unityDimensional(item.embedding)))
        ]);

        return {
          tokens, // token数量？大概是
          vectors // 向量
        };
      });

    return result;
  } catch (error) {
    console.log(`Embedding Error`, error);

    return Promise.reject(error);
  }
}

function unityDimensional(vector: number[]) {
  if (vector.length > 1536) {
    console.log(
      `The current vector dimension is ${vector.length}, and the vector dimension cannot exceed 1536. The first 1536 dimensions are automatically captured`
    );
    return vector.slice(0, 1536);
  }
  let resultVector = vector;
  const vectorLen = vector.length;

  const zeroVector = new Array(1536 - vectorLen).fill(0);

  return resultVector.concat(zeroVector);
}
