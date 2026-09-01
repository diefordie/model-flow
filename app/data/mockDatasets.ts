/**
 * Mock dataset fixtures for Sprint 2.
 *
 * Two pre-seeded datasets — one per project — that match the PRD's
 * "CSV upload → paginated preview → per-column profile" flow. The
 * frontend renders these as if they came from a real backend; flipping
 * `USE_MOCK = false` swaps to the live Hono+Supabase endpoint without
 * any UI changes.
 *
 * ponytail: hand-rolled fixtures for 2 datasets. Add more or replace
 *   with dynamic generation when we have a real sample.csv to load.
 */

import type { Dataset, DatasetPreviewResponse, ColumnMeta } from '~/types/api'

const PIMA_PROFILE: ColumnMeta[] = [
  { name: 'Pregnancies',       dataType: 'numeric',     missing: 0,  unique: 17 },
  { name: 'Glucose',           dataType: 'numeric',     missing: 5,  unique: 136 },
  { name: 'BloodPressure',     dataType: 'numeric',     missing: 35, unique: 47 },
  { name: 'SkinThickness',     dataType: 'numeric',     missing: 227,unique: 51 },
  { name: 'Insulin',           dataType: 'numeric',     missing: 374,unique: 186 },
  { name: 'BMI',               dataType: 'numeric',     missing: 11, unique: 163 },
  { name: 'DiabetesPedigreeFunction', dataType: 'numeric', missing: 0, unique: 517 },
  { name: 'Age',               dataType: 'numeric',     missing: 0,  unique: 52 },
  { name: 'Outcome',           dataType: 'binary',      missing: 0,  unique: 2 }
]

const HOUSING_PROFILE: ColumnMeta[] = [
  { name: 'LotArea',        dataType: 'numeric',     missing: 0,  unique: 1073 },
  { name: 'YearBuilt',      dataType: 'numeric',     missing: 0,  unique: 112 },
  { name: '1stFlrSF',       dataType: 'numeric',     missing: 0,  unique: 1081 },
  { name: '2ndFlrSF',       dataType: 'numeric',     missing: 0,  unique: 635 },
  { name: 'FullBath',       dataType: 'numeric',     missing: 0,  unique: 5 },
  { name: 'BedroomAbvGr',   dataType: 'numeric',     missing: 0,  unique: 7 },
  { name: 'TotRmsAbvGrd',   dataType: 'numeric',     missing: 0,  unique: 12 },
  { name: 'GarageCars',     dataType: 'numeric',     missing: 1,  unique: 7 },
  { name: 'Neighborhood',   dataType: 'categorical', missing: 0,  unique: 25 },
  { name: 'SalePrice',      dataType: 'numeric',     missing: 0,  unique: 1032 }
]

// Pima sample rows (canonical first 20 from UCI ML repo)
const PIMA_ROWS = [
  { Pregnancies: 6,  Glucose: 148, BloodPressure: 72, SkinThickness: 35, Insulin: 0,    BMI: 33.6, DiabetesPedigreeFunction: 0.627, Age: 50, Outcome: 1 },
  { Pregnancies: 1,  Glucose: 85,  BloodPressure: 66, SkinThickness: 29, Insulin: 0,    BMI: 26.6, DiabetesPedigreeFunction: 0.351, Age: 31, Outcome: 0 },
  { Pregnancies: 8,  Glucose: 183, BloodPressure: 64, SkinThickness: 0,  Insulin: 0,    BMI: 23.3, DiabetesPedigreeFunction: 0.672, Age: 32, Outcome: 1 },
  { Pregnancies: 1,  Glucose: 89,  BloodPressure: 66, SkinThickness: 23, Insulin: 94,   BMI: 28.1, DiabetesPedigreeFunction: 0.167, Age: 21, Outcome: 0 },
  { Pregnancies: 0,  Glucose: 137, BloodPressure: 40, SkinThickness: 35, Insulin: 168,  BMI: 43.1, DiabetesPedigreeFunction: 2.288, Age: 33, Outcome: 1 },
  { Pregnancies: 5,  Glucose: 116, BloodPressure: 74, SkinThickness: 0,  Insulin: 0,    BMI: 25.6, DiabetesPedigreeFunction: 0.201, Age: 30, Outcome: 0 },
  { Pregnancies: 3,  Glucose: 78,  BloodPressure: 50, SkinThickness: 32, Insulin: 88,   BMI: 31.0, DiabetesPedigreeFunction: 0.248, Age: 26, Outcome: 1 },
  { Pregnancies: 10, Glucose: 115, BloodPressure: 0,  SkinThickness: 0,  Insulin: 0,    BMI: 35.3, DiabetesPedigreeFunction: 0.134, Age: 29, Outcome: 0 },
  { Pregnancies: 2,  Glucose: 197, BloodPressure: 70, SkinThickness: 45, Insulin: 543,  BMI: 30.5, DiabetesPedigreeFunction: 0.158, Age: 53, Outcome: 1 },
  { Pregnancies: 8,  Glucose: 125, BloodPressure: 96, SkinThickness: 0,  Insulin: 0,    BMI: 0.0,  DiabetesPedigreeFunction: 0.232, Age: 54, Outcome: 1 },
  { Pregnancies: 4,  Glucose: 110, BloodPressure: 92, SkinThickness: 0,  Insulin: 0,    BMI: 37.6, DiabetesPedigreeFunction: 0.191, Age: 30, Outcome: 0 },
  { Pregnancies: 10, Glucose: 168, BloodPressure: 74, SkinThickness: 0,  Insulin: 0,    BMI: 38.0, DiabetesPedigreeFunction: 0.537, Age: 34, Outcome: 1 },
  { Pregnancies: 10, Glucose: 139, BloodPressure: 80, SkinThickness: 0,  Insulin: 0,    BMI: 27.1, DiabetesPedigreeFunction: 1.441, Age: 57, Outcome: 0 },
  { Pregnancies: 1,  Glucose: 189, BloodPressure: 60, SkinThickness: 23, Insulin: 846,  BMI: 30.1, DiabetesPedigreeFunction: 0.398, Age: 59, Outcome: 1 },
  { Pregnancies: 5,  Glucose: 166, BloodPressure: 72, SkinThickness: 19, Insulin: 175,  BMI: 25.8, DiabetesPedigreeFunction: 0.587, Age: 51, Outcome: 1 },
  { Pregnancies: 7,  Glucose: 100, BloodPressure: 0,  SkinThickness: 0,  Insulin: 0,    BMI: 30.0, DiabetesPedigreeFunction: 0.484, Age: 32, Outcome: 1 },
  { Pregnancies: 0,  Glucose: 118, BloodPressure: 84, SkinThickness: 47, Insulin: 230,  BMI: 45.8, DiabetesPedigreeFunction: 0.551, Age: 31, Outcome: 1 },
  { Pregnancies: 7,  Glucose: 107, BloodPressure: 74, SkinThickness: 0,  Insulin: 0,    BMI: 29.6, DiabetesPedigreeFunction: 0.254, Age: 31, Outcome: 1 },
  { Pregnancies: 1,  Glucose: 103, BloodPressure: 30, SkinThickness: 38, Insulin: 83,   BMI: 43.3, DiabetesPedigreeFunction: 0.183, Age: 33, Outcome: 0 },
  { Pregnancies: 1,  Glucose: 115, BloodPressure: 70, SkinThickness: 30, Insulin: 96,   BMI: 34.6, DiabetesPedigreeFunction: 0.529, Age: 32, Outcome: 1 }
]

const HOUSING_ROWS = [
  { LotArea: 8450, YearBuilt: 2003, '1stFlrSF': 856,  '2ndFlrSF': 854, FullBath: 2, BedroomAbvGr: 3, TotRmsAbvGrd: 8, GarageCars: 2, Neighborhood: 'CollgCr', SalePrice: 208500 },
  { LotArea: 9600, YearBuilt: 1976, '1stFlrSF': 1262, '2ndFlrSF': 0,   FullBath: 2, BedroomAbvGr: 3, TotRmsAbvGrd: 6, GarageCars: 2, Neighborhood: 'Veenker', SalePrice: 181500 },
  { LotArea: 11250,YearBuilt: 2001, '1stFlrSF': 920,  '2ndFlrSF': 866, FullBath: 2, BedroomAbvGr: 3, TotRmsAbvGrd: 6, GarageCars: 2, Neighborhood: 'Crawfor', SalePrice: 223500 },
  { LotArea: 9550, YearBuilt: 1915, '1stFlrSF': 961,  '2ndFlrSF': 756, FullBath: 1, BedroomAbvGr: 3, TotRmsAbvGrd: 7, GarageCars: 1, Neighborhood: 'NoRidge', SalePrice: 140000 },
  { LotArea: 14260,YearBuilt: 2000, '1stFlrSF': 1145, '2ndFlrSF': 1053,FullBath: 2, BedroomAbvGr: 4, TotRmsAbvGrd: 9, GarageCars: 3, Neighborhood: 'Mitchel', SalePrice: 250000 },
  { LotArea: 14115,YearBuilt: 1993, '1stFlrSF': 796,  '2ndFlrSF': 566, FullBath: 1, BedroomAbvGr: 1, TotRmsAbvGrd: 5, GarageCars: 1, Neighborhood: 'Somerst', SalePrice: 143000 },
  { LotArea: 10084,YearBuilt: 2004, '1stFlrSF': 1694, '2ndFlrSF': 0,   FullBath: 2, BedroomAbvGr: 3, TotRmsAbvGrd: 7, GarageCars: 2, Neighborhood: 'NWAmes',  SalePrice: 307000 },
  { LotArea: 10382,YearBuilt: 1973, '1stFlrSF': 1107, '2ndFlrSF': 983, FullBath: 2, BedroomAbvGr: 3, TotRmsAbvGrd: 7, GarageCars: 2, Neighborhood: 'OldTown', SalePrice: 200000 },
  { LotArea: 6120, YearBuilt: 1931, '1stFlrSF': 1022, '2ndFlrSF': 752, FullBath: 2, BedroomAbvGr: 2, TotRmsAbvGrd: 8, GarageCars: 2, Neighborhood: 'BrkSide', SalePrice: 129900 },
  { LotArea: 7420, YearBuilt: 1939, '1stFlrSF': 1077, '2ndFlrSF': 0,   FullBath: 1, BedroomAbvGr: 2, TotRmsAbvGrd: 5, GarageCars: 1, Neighborhood: 'Sawyer',  SalePrice: 118000 },
  { LotArea: 11200,YearBuilt: 1965, '1stFlrSF': 1040, '2ndFlrSF': 0,   FullBath: 1, BedroomAbvGr: 3, TotRmsAbvGrd: 6, GarageCars: 1, Neighborhood: 'NridgHt', SalePrice: 129500 },
  { LotArea: 11924,YearBuilt: 2005, '1stFlrSF': 1182, '2ndFlrSF': 1142,FullBath: 2, BedroomAbvGr: 4, TotRmsAbvGrd: 8, GarageCars: 2, Neighborhood: 'SawyerW', SalePrice: 345000 },
  { LotArea: 12968,YearBuilt: 1962, '1stFlrSF': 1216, '2ndFlrSF': 0,   FullBath: 1, BedroomAbvGr: 3, TotRmsAbvGrd: 6, GarageCars: 2, Neighborhood: 'NAmes',   SalePrice: 144000 },
  { LotArea: 10652,YearBuilt: 2006, '1stFlrSF': 1518, '2ndFlrSF': 1218,FullBath: 2, BedroomAbvGr: 4, TotRmsAbvGrd: 9, GarageCars: 2, Neighborhood: 'IDOTRR',  SalePrice: 279500 },
  { LotArea: 10920,YearBuilt: 1960, '1stFlrSF': 1240, '2ndFlrSF': 1036,FullBath: 2, BedroomAbvGr: 4, TotRmsAbvGrd: 7, GarageCars: 2, Neighborhood: 'CollgCr', SalePrice: 230000 },
  { LotArea: 6120, YearBuilt: 1927, '1stFlrSF': 824,  '2ndFlrSF': 0,   FullBath: 1, BedroomAbvGr: 2, TotRmsAbvGrd: 5, GarageCars: 0, Neighborhood: 'MeadowV', SalePrice:  98000 },
  { LotArea: 11241,YearBuilt: 1970, '1stFlrSF': 1442, '2ndFlrSF': 0,   FullBath: 2, BedroomAbvGr: 4, TotRmsAbvGrd: 7, GarageCars: 2, Neighborhood: 'Edwards', SalePrice: 173000 },
  { LotArea: 9317, YearBuilt: 1967, '1stFlrSF': 796,  '2ndFlrSF': 0,   FullBath: 1, BedroomAbvGr: 2, TotRmsAbvGrd: 5, GarageCars: 1, Neighborhood: 'BrkSide', SalePrice: 128000 },
  { LotArea: 6534, YearBuilt: 1958, '1stFlrSF': 1153, '2ndFlrSF': 0,   FullBath: 1, BedroomAbvGr: 3, TotRmsAbvGrd: 6, GarageCars: 0, Neighborhood: 'NAmes',   SalePrice: 108000 },
  { LotArea: 8848, YearBuilt: 2008, '1stFlrSF': 1680, '2ndFlrSF': 1535,FullBath: 2, BedroomAbvGr: 4, TotRmsAbvGrd: 10,GarageCars: 2, Neighborhood: 'StoneBr', SalePrice: 395000 }
]

export const DATASETS: Dataset[] = [
  {
    id: 'ds_pima',
    projectId: 'proj_diabetes',
    filename: 'diabetes.csv',
    sizeBytes: 24_000,
    rows: 768,
    columns: 9,
    uploadedAt: new Date(Date.now() - 86_400_000 * 6).toISOString(),
    status: 'ready'
  },
  {
    id: 'ds_housing',
    projectId: 'proj_housing',
    filename: 'ames_housing.csv',
    sizeBytes: 460_000,
    rows: 1460,
    columns: 10,
    uploadedAt: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    status: 'ready'
  }
]

export const PROFILES: Record<string, ColumnMeta[]> = {
  ds_pima: PIMA_PROFILE,
  ds_housing: HOUSING_PROFILE
}

export const ROWS: Record<string, Array<Record<string, unknown>>> = {
  ds_pima: PIMA_ROWS,
  ds_housing: HOUSING_ROWS
}

export const TOTAL_ROWS: Record<string, number> = {
  ds_pima: 768,
  ds_housing: 1460
}