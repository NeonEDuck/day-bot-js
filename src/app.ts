
import { Client, Events, GatewayIntentBits } from 'discord.js'
import collections from './commands.ts'
import { ValidationError } from './type/errors.ts'

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
})

collections.events.map((e) => {
    client.on(e.eventType, (...args) => {
        e.listener(client, ...args)
    })
})

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, client => {
	console.log(`Ready! Logged in as ${client.user.tag}`)
})

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return
    const command = collections.commands.get(interaction.commandName)

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`)
        return
    }

    try {
        await command.listener(interaction, client)
    }
    catch (error) {
        if (!(error instanceof ValidationError)) {
            console.error(error)
        }
        const content = (error instanceof ValidationError)?error.message:'There was an error while executing this command!'
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content , ephemeral: true })
        } else {
            await interaction.reply({ content, ephemeral: true })
        }
    }
})

// Log in to Discord with your client's token
client.login(process.env.TOKEN)