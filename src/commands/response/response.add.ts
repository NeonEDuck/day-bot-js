import { transaction } from '../../db.ts'
import { uniqueCombinations } from '../../utils/iterate.ts'
import { SubCommand } from '../../type/commands.ts'

export default SubCommand(
    (sub) =>
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
                    .setRequired(false)),
    async (ctx) => {
        const seperator = ctx.options.getString('seperator') ?? '|'
        const keywords  = ctx.options.getString('keywords', true).split(seperator).map(x => x.toLowerCase().trim())
        const replys    = ctx.options.getString('replys', true).split(seperator).map(x => x.toLowerCase().trim())
        await ctx.deferReply({ephemeral: true})

        if (keywords.length == 0 || replys.length == 0) {
            await ctx.editReply({content: 'There must be at least one keyword/reply in the argrements'})
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

            const bulkInsertPromises = uniqueCombinations(keywordIds, replyIds, (x, y) => [x, y]).map(([keywordId, replyId]) => new Promise<void>(async (resolve) => {
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

        await ctx.editReply({content: 'Responses has been added!'})
    }
)