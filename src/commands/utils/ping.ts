import { SlashCommandBuilder } from 'discord.js'
import { Command } from '../../typing/commands.ts'

export default new Command({
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    run: async (ctx) => {
        await ctx.reply('Pong!');
    }
})