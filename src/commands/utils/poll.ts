import { ActionRowBuilder, EmbedBuilder, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js'
import { Command } from '../../typing/commands.ts'
import { query, transaction } from '../../db.ts'
import { combination, groupBy, logObject, zip } from '../../utils/functions.ts'
import format from 'pg-format'
import { inspect } from 'util'
import { ValidationError } from '../../utils/classes.ts'

// TODO 建立投票資料庫
// TODO 實作 add, remove, modify, set-open, list

const tmpStore: any[] = []

const makePollEmbed = (data: any) => {
    const embed = new EmbedBuilder()
        .setTitle(`「${data.title}」`)
        .setAuthor({name: '投票'})
        .addFields({name: 'example', value: '3', inline: false})
        .setFooter({text: `${'≡'.repeat(43)}\n點擊下面選單以投票`})
    const component = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
            new StringSelectMenuBuilder()
                .addOptions({label: 'example 1', value: '0'}, {label: 'example 2', value: '1'}, {label: 'example 3', value: '2'})
                .setMinValues(1)
                .setMaxValues(data.maxVoteCounts)
                .setCustomId('poll')
        )
    return {embed, component}
}

export default new Command({
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('?')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a poll.')
                .addStringOption(option =>
                    option.setName('title')
                        .setNameLocalization('zh-TW', '標題')
                        .setDescription('The title of the poll.')
                        .setDescriptionLocalization('zh-TW', '投票標題。')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('options')
                        .setNameLocalization('zh-TW', '選項')
                        .setDescription('The options the poll provides.')
                        .setDescriptionLocalization('zh-TW', '投票選項，請使用「 | 」分開各個選項。(格式：選項A|選項B)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('closing_date')
                        .setNameLocalization('zh-TW', '關閉日期')
                        .setDescription('The closing date of the poll. (Default to infinity.)')
                        .setDescriptionLocalization('zh-TW', '投票關閉日期。(預設為無限。若無註明，將使用UTC時區)')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('max_vote_counts')
                        .setNameLocalization('zh-TW', '最大投票數')
                        .setDescription('Maximum options an user can vote for. (Default to 1)')
                        .setDescriptionLocalization('zh-TW', '一人最多能投幾個選項。(預設為1)')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('show_voted_users')
                        .setNameLocalization('zh-TW', '顯示成員')
                        .setDescription('Whether to show what voted users have voted for. (Default to false)')
                        .setDescriptionLocalization('zh-TW', '是否在投票選項上顯示成員的選擇。(預設為False)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('seperator')
                        .setNameLocalization('zh-TW', '分隔符號')
                        .setDescription('Customize what to sperate the keywords/replys args with. (Default to "|")')
                        .setDescriptionLocalization('zh-TW', '更改關鍵詞/回覆欄位的分隔符號。')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('ava')
                .setDescription('Add a poll.')
                .addAttachmentOption(option =>
                    option.setName('image')
                        .setDescription('The title of the poll.')
                        .setRequired(true))
        ),
    run: async (ctx, client) => {
        const subcommand = ctx.options.getSubcommand()
        const subfunctions: {[key: string]: () => Promise<void>} = {
            'add': async () => {
                const seperator      = ctx.options.getString('seperator') ?? '|'
                const title          = ctx.options.getString('title', true).trim()
                const options        = ctx.options.getString('options', true).split(seperator).map(x => x.trim())
                const closingDateStr = ctx.options.getString('closing_date')?.trim()
                const maxVoteCounts  = ctx.options.getInteger('max_vote_counts') ?? 1
                const showVotedUsers = ctx.options.getBoolean('show_voted_users') ?? false
                const msg = await ctx.deferReply({ephemeral: true});
                let closingDate: string|undefined
                if (closingDateStr) {
                    const d = new Date(closingDateStr)
                    if (isNaN(d.getTime())) {
                        throw new Error('closing_date格式錯誤。')
                    }
                    else if (d.getTime() <= Date.now()) {
                        throw new ValidationError(`${closingDateStr}已經過去了！`)
                    }
                    else {
                        closingDate = d.toISOString()
                    }
                }
                if (maxVoteCounts <= 0) {
                    throw new ValidationError(`max_vote_counts必須為大於等於1的值。`)
                }
                const data = {
                    id: msg.id,
                    title,
                    options,
                    closingDate,
                    maxVoteCounts,
                    showVotedUsers,
                    closed: false,
                    forced: false,
                    voted: {} as Record<string, string[]>,
                    messages: [msg.id] as string[],
                }
                const {embed, component} = makePollEmbed(data)
                //TODO 將資料加進資料庫
                tmpStore.push(data)
                logObject(tmpStore)
                await ctx.editReply({content: 'votes has been added!', embeds:[embed], components: [component]});
            },
            'list': async () => {
                //TODO

                // const seperator  = ctx.options.getString('seperator') || ','
                // const keywordIds = (ctx.options.getString('keyword_ids') || '').split(seperator).filter(x => x.trim() != '').map(x => Number(x))
                // type ResultType = {
                //     keyword_id: number
                //     keyword: string
                //     reply_id: number
                //     reply: string
                // }
                // let results: ResultType[] = []
                // if (keywordIds.length > 0) {
                //     const { rows } = await query<ResultType>(`
                //         SELECT responses.keyword_id AS keyword_id, response_keywords.content AS keyword, responses.reply_id AS reply_id, response_replys.content AS reply FROM responses
                //         LEFT JOIN response_keywords ON responses.keyword_id = response_keywords.keyword_id
                //         LEFT JOIN response_replys ON responses.reply_id = response_replys.reply_id
                //         WHERE responses.keyword_id IN (%L)
                //     `, keywordIds)
                //     results = rows
                // }
                // else {
                //     const { rows } = await query<ResultType>(`
                //         SELECT responses.keyword_id AS keyword_id, response_keywords.content AS keyword, responses.reply_id AS reply_id, response_replys.content AS reply FROM responses
                //         LEFT JOIN response_keywords ON responses.keyword_id = response_keywords.keyword_id
                //         LEFT JOIN response_replys ON responses.reply_id = response_replys.reply_id
                //     `)
                //     results = rows
                // }

                // const combineRows = results.map(({keyword_id, keyword, reply_id, reply}) => ({
                //     keyword: `\`${keyword_id.toString().padStart(2, '0')}\`: "${keyword}"`,
                //     reply: `\`${reply_id.toString().padStart(2, '0')}\` | ${reply}`,
                // }))

                // // const test = Object.entries(groupBy(combineRows, ({keyword}) => keyword))
                // //         .map(([keyword, keyRows]) => {
                // //             const replys = groupBy(keyRows, ({reply}) => reply)

                // //             // const temp: {keyword: (typeof keyword)[], replys: (typeof replys)[]} = {}
                // //             temp[keyword] = replys

                // //             return temp
                // //         })

                // const groupedRows = groupBy(
                //         groupBy(
                //             combineRows,
                //             ({keyword}) => keyword
                //         ).map(x => ({keyword: x[0].keyword, replys: x.map(({reply})=>reply)})),
                //         ({replys}) => replys
                //     ).map(x => ({keywords: x.map(({keyword}) => keyword), replys: x[0].replys}))


                // const seperatedTexts = groupedRows.reduce((acc: string[][], cur) => {
                //     const e = acc[acc.length-1]
                //     const text = `{${cur.keywords.join(', ')}}:\n${cur.replys.join('\n')}`

                //     if ([...e, text].join('\n\n').length > 1024) {
                //         acc.push([text])
                //     }
                //     else {
                //         e.push(text)
                //     }

                //     return acc
                // }, [[]])
                // const fields = seperatedTexts.map(texts => ({
                //     name: '\u200b',
                //     value: texts.join('\n\n'),
                //     inline: false
                // }))

                // const embed = new EmbedBuilder()
                //     .setTitle('Response List')
                //     .setDescription('{id: keyword...}:\nid|reply\n...')
                //     .addFields(...fields)
                await ctx.reply({content: 'Sorry, this is not yet implemented.', ephemeral: true})
            }
        }
        subcommand in subfunctions && await subfunctions[subcommand]()
    }
})