import { SubCommand } from '../../type/commands'

export default SubCommand(
    sub =>
        sub.setName('file')
            .setDescription('Set bot\'s avatar via file.')
            .setDescriptionLocalization('zh-TW', '使用檔案設置機器人的大頭貼')
            .addAttachmentOption(option =>
                option.setName('file')
                    .setNameLocalization('zh-TW', '檔案')
                    .setDescription('The image file.')
                    .setDescriptionLocalization('zh-TW', '圖片檔案。')
                    .setRequired(true)),
    async (ctx, client) => {
        const file = ctx.options.getAttachment('file')
        await ctx.deferReply({ephemeral: true})

        if (file == null) {
            await ctx.editReply({content: 'You must provide at least one option!'})
            return
        }
        await client.user?.setAvatar(file?.url)

        await ctx.editReply({content: 'Avatar set!'})
    }
)