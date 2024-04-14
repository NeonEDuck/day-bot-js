import { Events, SlashCommandBuilder } from 'discord.js'
import { Command, CommandListener } from '../../type/commands.ts'
import { query, transaction } from '../../db.ts'
import { groupBy } from "../../utils/iterate.ts"
import { EventsWithListener } from '../../type/events.ts'
import scAdd from './response.add.ts'
import scRemove from './response.remove.ts'
import scList from './response.list.ts'

await transaction(async query => {
    const subTables = [
        query(`CREATE TABLE IF NOT EXISTS response_keywords (
            keyword_id serial PRIMARY KEY,
            content VARCHAR ( 100 ) UNIQUE NOT NULL
        );`),
        query(`CREATE TABLE IF NOT EXISTS response_replys (
            reply_id serial PRIMARY KEY,
            content VARCHAR ( 1000 ) UNIQUE NOT NULL
        );`),
    ]
    await Promise.all(subTables)
    await query(`CREATE TABLE IF NOT EXISTS responses (
        keyword_id integer,
        reply_id integer,
        PRIMARY KEY (keyword_id, reply_id),
        CONSTRAINT fk_keyword_id FOREIGN KEY(keyword_id) REFERENCES response_keywords(keyword_id) ON DELETE CASCADE,
        CONSTRAINT fk_reply_id FOREIGN KEY(reply_id) REFERENCES response_replys(reply_id) ON DELETE CASCADE
    );`)
})

export default Command(
    new SlashCommandBuilder()
        .setName('response')
        .setDescription('?')
        .addSubcommand(scAdd.builder)
        .addSubcommand(scRemove.builder)
        .addSubcommand(scList.builder),
    async (ctx, client) => {
        const subcommand = ctx.options.getSubcommand()
        const subfunctions: Record<string, CommandListener> = {
            'add': scAdd.listener,
            'remove': scRemove.listener,
            'list': scList.listener
        }
        await subfunctions[subcommand]?.(ctx, client)
    }
)

export const events = [
    EventsWithListener(
        Events.MessageCreate,
        async (client, message) => {
            if (message.author.id == client.user?.id) {
                return
            }

            const linkRegex = /((?:(?:https?|ftp):\/\/)[\w/\-?=%.]+\.[\w/\-&?=%.]+)/g

            const filteredMessage = message.content.replace(linkRegex, '').toLowerCase().replace('\\|', '|')

            const { rows } = await query<{keyword: string, reply: string}>(`
                SELECT k.content AS keyword, r.content AS reply FROM responses
                LEFT JOIN response_keywords AS k ON responses.keyword_id = k.keyword_id
                LEFT JOIN response_replys AS r ON responses.reply_id = r.reply_id
            `)

            const responseList = groupBy(
                rows,
                ({keyword}) => keyword
            ).map(x => ({keyword: x[0].keyword, replys: x.map(({reply})=>reply)}))

            const replyList: [number, string][] = []
            for (const {keyword, replys} of responseList) {
                const regexp = new RegExp(keyword, 'g')
                let match: RegExpExecArray | null
                while ((match = regexp.exec(filteredMessage)) !== null) {
                    replyList.push([match.index, replys[Math.floor(Math.random()*replys.length)]])
                }
            }
            const replyMsg = replyList.toSorted(([,a], [,b]) => b.length - a.length).toSorted(([a], [b]) => a - b).map(([, reply]) => reply).join('\n')

            if (replyMsg) {
                message.reply(replyMsg)
            }
        }
    )
]