import { SubCommand } from '../../type/commands'

export default SubCommand(
    sub =>
        sub.setName('link')
            .setDescription('Set bot\'s avatar via link.')
            .setDescriptionLocalization('zh-TW', '使用連結設置機器人的大頭貼')
            .addStringOption(option =>
                option.setName('link')
                    .setNameLocalization('zh-TW', '連結')
                    .setDescription('Link of the image.')
                    .setDescriptionLocalization('zh-TW', '圖片連結。')
                    .setRequired(true)),
    async (ctx, client) => {
        const link = ctx.options.getString('link')
        await ctx.deferReply({ephemeral: true})

        if (link == null) {
            await ctx.editReply({content: 'You must provide at least one option!'})
            return
        }
        await client.user?.setAvatar(link)

        await ctx.editReply({content: 'Avatar set!'})
    }
)