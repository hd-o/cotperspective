import unzipper from 'unzipper'
import request from 'request'
import { processData } from './processData'
import { COTData } from '../data/types'

const zipBaseURL = 'https://www.cftc.gov/sites/default/files/files/dea/history/'

export interface GetDataConfig {
  /** The latest year of which to load historical data */
  year: number
  /**
   * Minimum entries the current year should have,
   * otherwise load more data from previous year
   */
  minimumEntries: number
}

/** Fetch, and parse historical data from CFTC */
export const getData = async (config: GetDataConfig): Promise<COTData> => {
  console.log(`• Fetching COT data for year: ${config.year}`)
  const zipURL = `${zipBaseURL}deahistfo${config.year}.zip`

  // Current types for unzipper seem to be incorrect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directory = await unzipper.Open.url(request as any, zipURL)

  console.log('• Extracting data file')
  const file = directory.files.find((d) => d.path === 'annualof.txt')
  const contentBuffer = await file?.buffer()
  if (!contentBuffer) throw new Error('CSV content buffer undefined')

  console.log('• Reading data file content')
  const data = processData(contentBuffer.toString())

  console.log('• Checking data size')
  // If not enough entries in current year,
  // load previous year, and join the data for each market
  if (
    data['CHICAGO MERCANTILE EXCHANGE']['EURO FX']?.length <
    config.minimumEntries
  ) {
    console.log('• Fetching data for previous year')
    const previousYearData = await getData({
      ...config,
      year: config.year - 1
    })
    for (const exchange in data) {
      for (const market in data[exchange]) {
        const previousData = previousYearData[exchange][market]
        if (previousData) data[exchange][market].push(...previousData)
      }
    }
  }

  console.log('• Successfully fetched data')
  return data
}

export type GetData = typeof getData
