import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js'
import { Command } from '../../typing/commands.ts'
import { getRecruitmentRecommendation } from '../../arknights.ts'

export default new Command({
    data: new SlashCommandBuilder()
        .setName('arknights')
        .setDescription('?')
        .addSubcommand(sub =>
            sub.setName('recruitment')
                .setDescription('Make a chart for you.')
                .addAttachmentOption(option =>
                    option.setName('file')
                        .setNameLocalization('zh-TW', '檔案')
                        .setDescription('The image file.')
                        .setDescriptionLocalization('zh-TW', '圖片檔案。')
                        .setRequired(true))
        ),
    run: async (ctx, client) => {
        const subcommand = ctx.options.getSubcommand()
        const subfunctions: {[key: string]: () => Promise<void>} = {
            'recruitment': async () => {
                const file      = ctx.options.getAttachment('file', true)
                await ctx.deferReply({ephemeral: true})

                const result = await getRecruitmentRecommendation(file.url)

                if      (result == null) {
                    await ctx.editReply({content: '找不到任何標籤'})
                }
                else if (result.buffer) {
                    const attachment = new AttachmentBuilder(result.buffer, {name: 'out.png'})
                    await ctx.editReply({content: `*"${result.tags.join(', ')}"* 可以這樣組合：`, files: [attachment]});
                }
                else {
                    await ctx.editReply({content: `*"${result.tags.join(', ')}"* 組合毫無特色`})
                }
            }
        }
        subcommand in subfunctions && await subfunctions[subcommand]()
    }
})