import { SlashCommandBuilder } from 'discord.js'
import { Command } from '../../typing/commands.ts'

export default new Command({
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('?')
        .addSubcommandGroup(grp =>
            grp.setName('set')
                .setDescription('Set bot\'s avatar.')
                .setDescriptionLocalization('zh-TW', '設置機器人的大頭貼')
                .addSubcommand(sub =>
                    sub.setName('link')
                        .setDescription('Set bot\'s avatar via link.')
                        .setDescriptionLocalization('zh-TW', '使用連結設置機器人的大頭貼')
                        .addStringOption(option =>
                            option.setName('link')
                                .setNameLocalization('zh-TW', '連結')
                                .setDescription('Link of the image.')
                                .setDescriptionLocalization('zh-TW', '圖片連結。')
                                .setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('file')
                        .setDescription('Set bot\'s avatar via file.')
                        .setDescriptionLocalization('zh-TW', '使用檔案設置機器人的大頭貼')
                        .addAttachmentOption(option =>
                            option.setName('file')
                                .setNameLocalization('zh-TW', '檔案')
                                .setDescription('The image file.')
                                .setDescriptionLocalization('zh-TW', '圖片檔案。')
                                .setRequired(true))
                ),
        ),
    run: async (ctx, client) => {
        const subcommand = `${ctx.options.getSubcommandGroup()} ${ctx.options.getSubcommand()}`
        const subfunctions: {[key: string]: () => Promise<void>} = {
            'set link': async () => {
                const link = ctx.options.getString('link')
                await ctx.deferReply({ephemeral: true})

                if (link == null) {
                    await ctx.editReply({content: 'You must provide at least one option!'});
                    return
                }
                await client.user?.setAvatar(link)

                await ctx.editReply({content: 'Avatar set!'});
            },
            'set file': async () => {
                const file = ctx.options.getAttachment('file')
                await ctx.deferReply({ephemeral: true})

                if (file == null) {
                    await ctx.editReply({content: 'You must provide at least one option!'});
                    return
                }
                await client.user?.setAvatar(file?.url)

                await ctx.editReply({content: 'Avatar set!'});
            },
        }
        subcommand in subfunctions && await subfunctions[subcommand]()
    }
})