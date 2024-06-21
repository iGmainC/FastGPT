import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { connectToDatabase } from '@/service/mongo';
import { readFileContentFromMongo } from '@fastgpt/service/common/file/gridfs/controller';
import { authDataset } from '@fastgpt/service/support/permission/auth/dataset';
import { FileIdCreateDatasetCollectionParams } from '@fastgpt/global/core/dataset/api';
import { createOneCollection } from '@fastgpt/service/core/dataset/collection/controller';
import {
  DatasetCollectionTypeEnum,
  TrainingModeEnum
} from '@fastgpt/global/core/dataset/constants';
import { BucketNameEnum } from '@fastgpt/global/common/file/constants';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { checkDatasetLimit } from '@fastgpt/service/support/permission/teamLimit';
import { predictDataLimitLength } from '@fastgpt/global/core/dataset/utils';
import { pushDataListToTrainingQueue } from '@fastgpt/service/core/dataset/training/controller';
import { createTrainingUsage } from '@fastgpt/service/support/wallet/usage/controller';
import { UsageSourceEnum } from '@fastgpt/global/support/wallet/usage/constants';
import { getLLMModel, getVectorModel } from '@fastgpt/service/core/ai/model';
import { rawText2Chunks } from '@fastgpt/service/core/dataset/read';

// COMT: 创建知识库中数据集的api
export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const { datasetId, parentId, fileId } = req.body as FileIdCreateDatasetCollectionParams;
  const trainingType = TrainingModeEnum.chunk;

  try {
    await connectToDatabase();

    // COMT: 鉴权
    const { teamId, tmbId, dataset } = await authDataset({
      req,
      authToken: true,
      authApiKey: true,
      per: 'w',
      datasetId: datasetId
    });

    // COMT: 从mongo中读取文件内容，并转换为文本
    const { rawText, filename } = await readFileContentFromMongo({
      teamId,
      bucketName: BucketNameEnum.dataset,
      fileId,
      isQAImport: true
    });
    console.log(rawText);
    // 2. split chunks
    // COMT: 切分文本为Chunks
    const chunks = rawText2Chunks({
      rawText,
      isQAImport: true
    });

    // 3. auth limit
    // COMT: 检查数据集的限制，这应该主要是pro版的限制
    await checkDatasetLimit({
      teamId,
      insertLen: predictDataLimitLength(trainingType, chunks)
    });
    // COMT: 使用mongo事务，创建知识库中的数据集
    await mongoSessionRun(async (session) => {
      // 4. create collection
      // COMT: 创建知识库中的数据集
      const { _id: collectionId } = await createOneCollection({
        teamId,
        tmbId,
        name: filename,
        parentId,
        datasetId,
        type: DatasetCollectionTypeEnum.file,
        fileId,
        // special metadata
        trainingType,
        chunkSize: 0,
        session
      });

      // 5. create training bill
      // COMT: 创建训练账单
      const { billId } = await createTrainingUsage({
        teamId,
        tmbId,
        appName: filename,
        billSource: UsageSourceEnum.training,
        vectorModel: getVectorModel(dataset.vectorModel)?.name,
        agentModel: getLLMModel(dataset.agentModel)?.name,
        session
      });

      // 6. insert to training queue
      // COMT: 将数据插入到训练队列中，切分完的chunk片
      await pushDataListToTrainingQueue({
        teamId,
        tmbId,
        datasetId: dataset._id,
        collectionId,
        agentModel: dataset.agentModel,
        vectorModel: dataset.vectorModel,
        trainingMode: trainingType,
        billId,
        data: chunks.map((chunk, index) => ({
          q: chunk.q,
          a: chunk.a,
          chunkIndex: index
        })),
        session
      });

      return collectionId;
    });

    jsonRes(res);
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}
