import { DatasetDataIndexItemType, DatasetSchemaType } from './type';
import { TrainingModeEnum, DatasetCollectionTypeEnum } from './constants';
import type { LLMModelItemType } from '../ai/model.d';

/* ================= dataset ===================== */
export type DatasetUpdateBody = {
  id: string;
  parentId?: string;
  name?: string;
  avatar?: string;
  intro?: string;
  permission?: DatasetSchemaType['permission'];
  agentModel?: LLMModelItemType;
  status?: DatasetSchemaType['status'];

  websiteConfig?: DatasetSchemaType['websiteConfig'];
  externalReadUrl?: DatasetSchemaType['externalReadUrl'];
};

/* ================= collection ===================== */
export type DatasetCollectionChunkMetadataType = {
  parentId?: string;
  trainingType?: TrainingModeEnum;
  chunkSize?: number;
  chunkSplitter?: string;
  qaPrompt?: string;
  metadata?: Record<string, any>;
};

// create collection params
export type CreateDatasetCollectionParams = DatasetCollectionChunkMetadataType & {
  datasetId: string;
  name: string;
  type: DatasetCollectionTypeEnum;

  tags?: string[];

  fileId?: string;
  rawLink?: string;
  externalFileId?: string;

  externalFileUrl?: string;
  rawTextLength?: number;
  hashRawText?: string;
};

export type ApiCreateDatasetCollectionParams = DatasetCollectionChunkMetadataType & {
  datasetId: string;
  tags?: string[];
};
export type TextCreateDatasetCollectionParams = ApiCreateDatasetCollectionParams & {
  name: string;
  text: string;
};
export type LinkCreateDatasetCollectionParams = ApiCreateDatasetCollectionParams & {
  link: string;
};
export type FileIdCreateDatasetCollectionParams = ApiCreateDatasetCollectionParams & {
  fileId: string;
};
export type FileCreateDatasetCollectionParams = ApiCreateDatasetCollectionParams & {
  fileMetadata?: Record<string, any>;
  collectionMetadata?: Record<string, any>;
};
export type CsvTableCreateDatasetCollectionParams = {
  datasetId: string;
  parentId?: string;
  fileId: string;
};
export type ExternalFileCreateDatasetCollectionParams = ApiCreateDatasetCollectionParams & {
  externalFileId?: string;
  externalFileUrl: string;
  filename?: string;
};

/* ================= data ===================== */
export type PgSearchRawType = {
  id: string;
  collection_id: string;
  score: number;
};
// COMT: 塞到数据库里单条数据的结构
export type PushDatasetDataChunkProps = {
  q: string; // q是embedding的内容
  a?: string; // a是增强的内容
  chunkIndex?: number;
  indexes?: Omit<DatasetDataIndexItemType, 'dataId'>[];
};

export type PostWebsiteSyncParams = {
  datasetId: string;
  billId: string;
};

export type PushDatasetDataProps = {
  collectionId: string;
  data: PushDatasetDataChunkProps[];
  trainingMode: TrainingModeEnum;
  prompt?: string;
  billId?: string;
};
export type PushDatasetDataResponse = {
  insertLen: number;
};
