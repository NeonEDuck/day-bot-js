import { SlashCommandBuilder } from 'discord.js'
import { Command } from '../../type/commands.ts'

export default Command({
    builder: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    listener: async (ctx) => {
        await ctx.reply('Pong!')
    }
})