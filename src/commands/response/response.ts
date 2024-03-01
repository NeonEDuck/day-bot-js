import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import { Command } from '../../typing/commands.ts'
import { query, transaction } from '../../db.ts'
import { combination, groupBy, zip } from '../../utils/functions.ts'
import format from 'pg-format'
import { inspect } from 'util'

export default new Command({
    data: new SlashCommandBuilder()
        .setName('response')
        .setDescription('?')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add response entry.')
                .addStringOption(option =>
                    option.setName('keywords')
                        .setNameLocalization('zh-TW', '關鍵詞')
                        .setDescription('The words bots will be looking for.')
                        .setDescriptionLocalization('zh-TW', '機器人會尋找的詞句。')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('replys')
                        .setNameLocalization('zh-TW', '回覆')
                        .setDescription('The words bot will randomly pick to reply to.')
                        .setDescriptionLocalization('zh-TW', '機器人會隨機抽選回覆的詞句。')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('seperator')
                        .setNameLocalization('zh-TW', '分隔符號')
                        .setDescription('Customize what to sperate the keywords/replys args with. (Default to "|")')
                        .setDescriptionLocalization('zh-TW', '更改關鍵詞/回覆欄位的分隔符號。')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove response entry.')
                .addStringOption(option =>
                    option.setName('keyword_ids')
                        .setDescription('The keywords you want to remove. (Separate the words with ",")')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reply_ids')
                        .setDescription('Optional. Specify what replys you want to remove only. (Separate the sentences with ",")')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('seperator')
                        .setNameLocalization('zh-TW', '分隔符號')
                        .setDescription('Customize what to sperate the keywords/replys args with. (Default to ",")')
                        .setDescriptionLocalization('zh-TW', '更改關鍵詞/回覆欄位的分隔符號。')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List response entries in a table.')
                .addStringOption(option =>
                    option.setName('keyword_ids')
                        .setDescription('Optional. Only list certain keywords specify. (Separate the words with ",")')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('seperator')
                        .setNameLocalization('zh-TW', '分隔符號')
                        .setDescription('Customize what to sperate the keywords/replys args with. (Default to ",")')
                        .setDescriptionLocalization('zh-TW', '更改關鍵詞/回覆欄位的分隔符號。')
                        .setRequired(false))
        ),
    run: async (ctx) => {
        const subcommand = ctx.options.getSubcommand()
        const subfunctions: {[key: string]: () => Promise<void>} = {
            'add': async () => {
                const seperator = ctx.options.getString('seperator') ?? '|'
                const keywords  = ctx.options.getString('keywords', true).split(seperator).map(x => x.toLowerCase().trim())
                const replys    = ctx.options.getString('replys', true).split(seperator).map(x => x.toLowerCase().trim())
                await ctx.deferReply({ephemeral: true});

                if (keywords.length == 0 || replys.length == 0) {
                    await ctx.editReply({content: 'There must be at least one keyword/reply in the argrements'});
                }

                await transaction(async (query) => {
                    const { rows: existedKeywordRows } = await query<{keyword_id: number, content: string}>(`
                        SELECT *
                        FROM response_keywords
                        WHERE content IN (%L)
                    `, keywords)
                    const subKeywords = keywords.filter(x => !existedKeywordRows.map(x => x.content).includes(x))
                    const keywordIds = existedKeywordRows.map(x => x.keyword_id)

                    if (subKeywords.length > 0) {
                        const subKeywordIds = (await query<{keyword_id: number}>(`
                            INSERT INTO response_keywords (content)
                            VALUES %L
                            RETURNING keyword_id
                        `, subKeywords.map(x => [x]))).rows
                        keywordIds.push(...subKeywordIds.map(x => x.keyword_id))
                    }

                    const { rows: existedReplyRows } = await query<{reply_id: number, content: string}>(`
                        SELECT *
                        FROM response_replys
                        WHERE content IN (%L)
                    `, replys)
                    const subReplys = replys.filter(x => !existedReplyRows.map(x => x.content).includes(x))
                    const replyIds = existedReplyRows.map(x => x.reply_id)

                    if (subReplys.length > 0) {
                        const subReplyIds = (await query<{reply_id: number}>(`
                            INSERT INTO response_replys (content)
                            VALUES %L
                            RETURNING reply_id
                        `, subReplys.map(x => [x]))).rows
                        replyIds.push(...subReplyIds.map(x => x.reply_id))
                    }

                    const bulkInsertPromises = combination(keywordIds, replyIds, (x, y) => [x, y]).map(([keywordId, replyId]) => new Promise<void>(async (resolve) => {
                        await query(`
                            INSERT INTO responses (keyword_id, reply_id)
                            VALUES (%L)
                            ON CONFLICT (keyword_id, reply_id)
                            DO NOTHING
                        `, [keywordId, replyId])
                        resolve()
                    }))

                    await Promise.all(bulkInsertPromises)
                })

                await ctx.editReply({content: 'Responses has been added!'});
            },
            'remove': async () => {
                const seperator  = ctx.options.getString('seperator') ?? ','
                const keywordIds = ctx.options.getString('keyword_ids', true).split(seperator).map(x => Number(x))
                const replyIds   = (ctx.options.getString('reply_ids') ?? '').split(seperator).filter(x => x.trim() != '').map(x => Number(x))
                await ctx.deferReply({ephemeral: true})

                await transaction(async (query) => {
                    if (replyIds.length == 0) {
                        await query(`
                            DELETE FROM response_keywords
                            WHERE keyword_id IN (%L)
                        `, keywordIds)
                    }
                    else {
                        await query(`
                            DELETE FROM responses
                            WHERE keyword_id IN (%L)
                            AND reply_id IN (%L)
                        `, keywordIds, replyIds)
                        await Promise.all([
                            new Promise<void>(async (resolve) => {
                                await query(`
                                    DELETE FROM response_keywords
                                    WHERE keyword_id NOT IN (
                                        SELECT keyword_id FROM responses
                                    )
                                `)
                                resolve()
                            }),
                            new Promise<void>(async (resolve) => {
                                await query(`
                                    DELETE FROM response_replys
                                    WHERE reply_id NOT IN (
                                        SELECT reply_id FROM responses
                                    )
                                `)
                                resolve()
                            }),
                        ])
                    }
                })

                await ctx.editReply({content: 'remove!'});
            },
            'list': async () => {
                const seperator  = ctx.options.getString('seperator') ?? ','
                const keywordIds = (ctx.options.getString('keyword_ids') ?? '').split(seperator).filter(x => x.trim() != '').map(x => Number(x))
                type ResultType = {
                    keyword_id: number
                    keyword: string
                    reply_id: number
                    reply: string
                }
                let results: ResultType[] = []
                if (keywordIds.length > 0) {
                    const { rows } = await query<ResultType>(`
                        SELECT responses.keyword_id AS keyword_id, response_keywords.content AS keyword, responses.reply_id AS reply_id, response_replys.content AS reply FROM responses
                        LEFT JOIN response_keywords ON responses.keyword_id = response_keywords.keyword_id
                        LEFT JOIN response_replys ON responses.reply_id = response_replys.reply_id
                        WHERE responses.keyword_id IN (%L)
                    `, keywordIds)
                    results = rows
                }
                else {
                    const { rows } = await query<ResultType>(`
                        SELECT responses.keyword_id AS keyword_id, response_keywords.content AS keyword, responses.reply_id AS reply_id, response_replys.content AS reply FROM responses
                        LEFT JOIN response_keywords ON responses.keyword_id = response_keywords.keyword_id
                        LEFT JOIN response_replys ON responses.reply_id = response_replys.reply_id
                    `)
                    results = rows
                }

                const combineRows = results.map(({keyword_id, keyword, reply_id, reply}) => ({
                    keyword: `\`${keyword_id.toString().padStart(2, '0')}\`: "${keyword}"`,
                    reply: `\`${reply_id.toString().padStart(2, '0')}\` | ${reply}`,
                }))

                // const test = Object.entries(groupBy(combineRows, ({keyword}) => keyword))
                //         .map(([keyword, keyRows]) => {
                //             const replys = groupBy(keyRows, ({reply}) => reply)

                //             // const temp: {keyword: (typeof keyword)[], replys: (typeof replys)[]} = {}
                //             temp[keyword] = replys

                //             return temp
                //         })

                const groupedRows = groupBy(
                        groupBy(
                            combineRows,
                            ({keyword}) => keyword
                        ).map(x => ({keyword: x[0].keyword, replys: x.map(({reply})=>reply)})),
                        ({replys}) => replys
                    ).map(x => ({keywords: x.map(({keyword}) => keyword), replys: x[0].replys}))


                const seperatedTexts = groupedRows.reduce((acc: string[][], cur) => {
                    const e = acc[acc.length-1]
                    const text = `{${cur.keywords.join(', ')}}:\n${cur.replys.join('\n')}`

                    if ([...e, text].join('\n\n').length > 1024) {
                        acc.push([text])
                    }
                    else {
                        e.push(text)
                    }

                    return acc
                }, [[]])
                const fields = seperatedTexts.map(texts => ({
                    name: '\u200b',
                    value: texts.join('\n\n'),
                    inline: false
                }))

                const embed = new EmbedBuilder()
                    .setTitle('Response List')
                    .setDescription('{id: keyword...}:\nid|reply\n...')
                    .addFields(...fields)

                await ctx.reply({embeds: [embed], ephemeral: false})
            }
        }
        subcommand in subfunctions && await subfunctions[subcommand]()
    }
})