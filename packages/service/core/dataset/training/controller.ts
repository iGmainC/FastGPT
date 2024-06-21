import { MongoDatasetTraining } from './schema';
import type {
  PushDatasetDataChunkProps,
  PushDatasetDataProps,
  PushDatasetDataResponse
} from '@fastgpt/global/core/dataset/api.d';
import { TrainingModeEnum } from '@fastgpt/global/core/dataset/constants';
import { simpleText } from '@fastgpt/global/common/string/tools';
import { ClientSession } from '../../../common/mongo';
import { getLLMModel, getVectorModel } from '../../ai/model';
import { addLog } from '../../../common/system/log';
import { getCollectionWithDataset } from '../controller';

export const lockTrainingDataByTeamId = async (teamId: string): Promise<any> => {
  try {
    await MongoDatasetTraining.updateMany(
      {
        teamId
      },
      {
        lockTime: new Date('2999/5/5')
      }
    );
  } catch (error) {}
};

export const pushDataListToTrainingQueueByCollectionId = async ({
  collectionId,
  ...props
}: {
  teamId: string;
  tmbId: string;
  session?: ClientSession;
} & PushDatasetDataProps) => {
  const {
    datasetId: { _id: datasetId, agentModel, vectorModel }
  } = await getCollectionWithDataset(collectionId);
  return pushDataListToTrainingQueue({
    ...props,
    datasetId,
    collectionId,
    agentModel,
    vectorModel
  });
};

// COMT: 将切片好的数据插入到训练队列中
export async function pushDataListToTrainingQueue({
  teamId,
  tmbId,
  datasetId,
  collectionId,
  agentModel,
  vectorModel,
  data,
  prompt,
  billId,
  trainingMode = TrainingModeEnum.chunk,
  session
}: {
  teamId: string;
  tmbId: string;
  datasetId: string;
  agentModel: string;
  vectorModel: string;
  session?: ClientSession;
} & PushDatasetDataProps): Promise<PushDatasetDataResponse> {
  const checkModelValid = async () => {
    const agentModelData = getLLMModel(agentModel); // 获取LLM模型
    if (!agentModelData) {
      return Promise.reject(`File model ${agentModel} is inValid`);
    }
    const vectorModelData = getVectorModel(vectorModel); // 获取向量化模型
    if (!vectorModelData) {
      return Promise.reject(`Vector model ${vectorModel} is inValid`);
    }

    if (trainingMode === TrainingModeEnum.chunk) {// 如果是切片模式走向量化的逻辑
      return {
        maxToken: vectorModelData.maxToken * 1.3,
        model: vectorModelData.model,
        weight: vectorModelData.weight
      };
    }

    if (trainingMode === TrainingModeEnum.qa || trainingMode === TrainingModeEnum.auto) { // 如果是问答模式或者自动模式走LLM的逻辑
      return {
        maxToken: agentModelData.maxContext * 0.8,
        model: agentModelData.model,
        weight: 0
      };
    }

    return Promise.reject(`Training mode "${trainingMode}" is inValid`);
  };

  const { model, maxToken, weight } = await checkModelValid();

  // format q and a, remove empty char
  data.forEach((item) => {
    // 格式化问题和答案，去除空字符
    item.q = simpleText(item.q);
    item.a = simpleText(item.a);

    item.indexes = item.indexes // 格式化索引，去除空字符
      ?.map((index) => {
        return {
          ...index,
          text: simpleText(index.text)
        };
      })
      .filter(Boolean);
  });

  // filter repeat or equal content
  const set = new Set();
  const filterResult: Record<string, PushDatasetDataChunkProps[]> = {
    success: [],
    overToken: [],
    repeat: [],
    error: []
  };

  // filter repeat content
  data.forEach((item) => {
    if (!item.q) { // 如果问题为空，直接加入到错误列表中，不做处理
      filterResult.error.push(item);
      return;
    }

    const text = item.q + item.a;

    // count q token
    const token = item.q.length;

    if (token > maxToken) {// 如果问题的长度超过了最大token，加入到超过token的列表中
      filterResult.overToken.push(item);
      return;
    }

    if (set.has(text)) {// 如果set中已经存在了这个问题，加入到重复的列表中
      console.log('repeat', item);
      filterResult.repeat.push(item);
    } else { // 否则加入到成功列表中
      filterResult.success.push(item);
      set.add(text);
    }
  });

  // insert data to db
  const insertLen = filterResult.success.length;
  const failedDocuments: PushDatasetDataChunkProps[] = [];

  // 使用 insertMany 批量插入
  try {
    await MongoDatasetTraining.insertMany(
      filterResult.success.map((item) => ({
        teamId,
        tmbId,
        datasetId,
        collectionId,
        billId,
        mode: trainingMode,
        prompt,
        model,
        q: item.q,
        a: item.a,
        chunkIndex: item.chunkIndex ?? 0,
        weight: weight ?? 0,
        indexes: item.indexes
      })),
      {
        session,
        ordered: false
      }
    );
  } catch (error: any) {
    addLog.error(`Insert error`, error);
    // 如果有错误，将失败的文档添加到失败列表中
    error.writeErrors?.forEach((writeError: any) => {
      failedDocuments.push(data[writeError.index]);
    });
    console.log('failed', failedDocuments);
  }

  // 对于失败的文档，尝试单独插入
  for await (const item of failedDocuments) {
    await MongoDatasetTraining.create(item);
  }

  delete filterResult.success;

  return {
    insertLen,
    ...filterResult
  };
}
