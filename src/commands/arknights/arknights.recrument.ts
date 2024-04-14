import { AttachmentBuilder } from 'discord.js'
import { SubCommand } from '../../type/commands.ts'
import { getRecruitmentRecommendation } from './arknights.ts'

export default SubCommand(
    (sub) =>
        sub.setName('recruitment')
            .setDescription('Make a chart for you.')
            .addAttachmentOption(option =>
                option.setName('file')
                    .setNameLocalization('zh-TW', '檔案')
                    .setDescription('The image file.')
                    .setDescriptionLocalization('zh-TW', '圖片檔案。')
                    .setRequired(true)),
    async (ctx) => {
        const file = ctx.options.getAttachment('file', true)
        await ctx.deferReply({ephemeral: true})

        const result = await getRecruitmentRecommendation(file.url)

        if (result == null) {
            await ctx.editReply({content: '找不到任何標籤'})
        }
        else if (result.buffer) {
            const attachment = new AttachmentBuilder(result.buffer, {name: 'out.png'})
            await ctx.editReply({content: `*"${result.tags.join(', ')}"* 可以這樣組合：`, files: [attachment]})
        }
        else {
            await ctx.editReply({content: `*"${result.tags.join(', ')}"* 組合毫無特色`})
        }
    }
)