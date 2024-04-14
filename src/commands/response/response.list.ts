import { query } from '../../db.ts'
import { groupBy } from "../../utils/iterate.ts"
import { SubCommand } from '../../type/commands.ts'
import { EmbedBuilder } from 'discord.js'

export default SubCommand(
    (sub) =>
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
                    .setRequired(false)),
    async (ctx) => {
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
)