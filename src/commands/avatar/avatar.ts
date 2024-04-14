import { SlashCommandBuilder } from 'discord.js'
import { Command, CommandListener } from '../../type/commands.ts'
import scSetLink from './avatar.set.link.ts'
import scSetFile from './avatar.set.file.ts'

export default Command({
    builder: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('?')
        .addSubcommandGroup(grp =>
            grp.setName('set')
                .setDescription('Set bot\'s avatar.')
                .setDescriptionLocalization('zh-TW', '設置機器人的大頭貼')
                .addSubcommand(scSetLink.builder)
                .addSubcommand(scSetFile.builder),
        ),
    listener: async (ctx, client) => {
        const subcommand = `${ctx.options.getSubcommandGroup()} ${ctx.options.getSubcommand()}`
        const subListeners: Record<string, CommandListener> = {
            'set link': scSetLink.listener,
            'set file': scSetFile.listener,
        }
        await subListeners[subcommand]?.(ctx, client)
    }
})