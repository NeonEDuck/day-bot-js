import format from 'pg-format'
import pg from 'pg'

type QueryType<T = {}> = <U extends T & pg.QueryResultRow>(sql: string, ...values: any[]) => Promise<pg.QueryResult<U>>

const ssl = ['true', '1', 't'].includes((process.env?.DATABASE_SSL || 'false').toLowerCase())

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

export const query: QueryType = <T extends pg.QueryResultRow>(sql: string, ...values: any[]) => {
    return new Promise<pg.QueryResult<T>>((resolve, reject) => {
        const client = new pg.Client({
            connectionString: process.env.DATABASE_URL!,
            ssl,
        })
        client.connect()

        client.query(format(sql, ...values), [], (err, results) => {
            if (err) {
                reject(err)
            }
            else {
                resolve(results)
            }

            client.end()
        })
    })
}

export const transaction = <T extends pg.QueryResultRow>(f: (query: QueryType<T>) => Promise<pg.QueryResult<T>|void>) => {
    return new Promise(async (resolve: (result: pg.QueryResult<T>) => void, reject) => {
        const client = new pg.Client({
            connectionString: process.env.DATABASE_URL!,
            ssl
        })
        client.connect()

        const query: QueryType<T> = (sql, ...values) => new Promise((resolve, reject) => {
            client.query(format(sql, ...values), [], (err, results) => {
                if (err) {
                    reject(err)
                }
                else {
                    resolve(results)
                }
            })
        })

        try {
            const result = (await f(query)) || {} as pg.QueryResult
            resolve(result)
        }
        catch (err) {
            reject(err)
        }
        finally {
            client.end()
        }
    })
}