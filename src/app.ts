
import { AttachmentBuilder, Client, Events, GatewayIntentBits } from 'discord.js'
import commands from './commands.ts'
import { query } from './db.ts';
import { groupBy } from './utils/functions.ts';
import { ValidationError } from './utils/classes.ts';
import { getRecruitmentRecommendation } from './arknights.ts';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, client => {
	console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.run(interaction, client)
    } catch (error) {
        if (!(error instanceof ValidationError)) {
            console.error(error);
        }
        const content = (error instanceof ValidationError)?error.message:'There was an error while executing this command!'
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content , ephemeral: true });
        } else {
            await interaction.reply({ content, ephemeral: true });
        }
    }
});

client.on(Events.MessageCreate, async message => {
    if (message.author.id == client.user?.id) {
        return
    }

    if (message.attachments.size > 0) {
        message.attachments.each(async (attachment) => {
            if (!attachment.url.match(/png|jpe?g$/)) return

            const result = await getRecruitmentRecommendation(attachment.url)
            if      (result == null) {
                return
            }
            else if (result.buffer) {
                const attachment = new AttachmentBuilder(result.buffer, {name: 'out.png'})
                await message.reply({content: `*"${result.tags.join(', ')}"* 可以這樣組合：`, files: [attachment]});
            }
            else if (result.tags.length >= 3) {
                await message.reply({content: `*"${result.tags.join(', ')}"* 組合毫無特色`})
            }
        })
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
})

// Log in to Discord with your client's token
client.login(process.env.TOKEN);