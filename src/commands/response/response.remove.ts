import { transaction } from '../../db.ts'
import { SubCommand } from '../../type/commands.ts'

export default SubCommand(
    (sub) =>
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
                    .setRequired(false)),
    async (ctx) => {
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
    }
)