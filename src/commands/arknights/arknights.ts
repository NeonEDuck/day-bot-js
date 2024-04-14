import sharp from 'sharp'
import opencc from 'opencc'
import CryptoJS from 'crypto-js'
import { createScheduler, createWorker } from 'tesseract.js'
import { AttachmentBuilder, Events, SlashCommandBuilder } from 'discord.js'
import { Command, CommandListener } from '../../type/commands.ts'
import { EventsWithListener } from '../../type/events.ts'
import { booleanXOR, proximatelyEqual, stringProximatelyEqual } from '../../utils/functions.ts'
import { combinations } from "../../utils/iterate.ts"
import scRecrument from './arknights.recrument.ts'


export default Command(
    new SlashCommandBuilder()
        .setName('arknights')
        .setDescription('?')
        .addSubcommand(scRecrument.builder),
    async (ctx, client) => {
        const subcommand = ctx.options.getSubcommand()
        const subListeners: Record<string, CommandListener> = {
            'recruitment': scRecrument.listener
        }
        await subListeners[subcommand]?.(ctx, client)
    }
)

export const events = [
    EventsWithListener(
        Events.MessageCreate,
        async (client, message) => {
            if (message.author.id == client.user?.id) {
                return
            }

            if (message.attachments.size > 0) {
                message.attachments.each(async (attachment) => {
                    if (!attachment.url.match(/png|jpe?g$/)) return

                    const result = await getRecruitmentRecommendation(attachment.url)
                    if (result == null) {
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
        }
    )
]



const MIN_CHECK_DISTANT = 4
const MAX_CHECK_DISTANT = 8
const ERROR = 3
const COLUMN_COUNT = 20
const MAX_RETRY_COUNT = 5
const t2s = new opencc.OpenCC('t2s.json')
const scheduler = createScheduler();
scheduler.addWorker(await createWorker('chi_tra'))
scheduler.addWorker(await createWorker('chi_tra'))

function addText(text: string, width: number) {
    const height = 30;

    const svgText = `
    <svg width="${width}" height="${height}">
        <style>
            .title { font-size: 20px; font-family: "Noto Sans TC", "sans-serif" }
        </style>
        <text x="0%" y="80%" class="title">${text}</text>
    </svg>`

    return Buffer.from(svgText);
}

function cal(data: {comb: {}[], ops: {rarity: number}[]}) {
    return data.comb.length + Math.max(...data.ops.map(op => op.rarity))*10 + Math.min(...data.ops.map(op => op.rarity))*1000
}

export const getRecruitmentRecommendation = async (url: string): Promise<{tags:string[], buffer?:Buffer}|null> => {
    console.time('total spend')
    console.time('find points')
    console.log('--------------------')
    console.log(`processing image...`)

    const imageBuffer = Buffer.from(await (await fetch(url)).arrayBuffer())
    const image = sharp(await sharp(imageBuffer)
                    .extend({
                        top:    MAX_CHECK_DISTANT+1,
                        left:   MAX_CHECK_DISTANT+1,
                        right:  MAX_CHECK_DISTANT+1,
                        bottom: MAX_CHECK_DISTANT+1,
                        background: 'white'
                    }).toBuffer())

    console.time('negate')
    const { data, info: { width, height } } = await image.clone().threshold().grayscale().raw().toBuffer({resolveWithObject: true})

    console.timeEnd('negate')
    const found: number[][] = []

    for (let i = MAX_CHECK_DISTANT*width; i < data.length-MAX_CHECK_DISTANT*width; i++) {
        if (data[i] != 0) continue
        const [ curX, curY ] = [i%width, Math.floor(i/width)]

        if (curX - MAX_CHECK_DISTANT < 0 ||
            curY - MAX_CHECK_DISTANT < 0 ||
            curX + MAX_CHECK_DISTANT >= width ||
            curY + MAX_CHECK_DISTANT >= height) {
            continue
        }

        const isLeftAllWhite = data.subarray(i-MAX_CHECK_DISTANT, i-MIN_CHECK_DISTANT+1).every((x) => x==255)
        const isRightAllBlack = data.subarray(i+MIN_CHECK_DISTANT, i+MAX_CHECK_DISTANT+1).every((x) => x==0)

        let check = isLeftAllWhite && isRightAllBlack
        for (let j = MIN_CHECK_DISTANT; j <= MAX_CHECK_DISTANT; j++) {
            if (!check) break

            if (!(data[i-(j*width)] == 255 &&
                data[i+(j*width)] == 0)) {
                check = false
            }
        }
        if (check && !found.find(([x, y]) => proximatelyEqual(x, curX, ERROR*2) && proximatelyEqual(y, curY, ERROR*2))) {
            found.push([curX, curY])
        }
    }

    console.timeEnd('find points')
    console.time('filter points')

    const found2: number[][] = []

    found.map(([x, y], i) => {
        if (found2.flat().includes(i)) return
        if (found2.map(([i]) => proximatelyEqual(x, found[i][0], ERROR) && proximatelyEqual(y, found[i][1], ERROR)).some(x => x)) return
        const distantBetween = found.map(([m, n]) => [m-x, n-y]).map(([m, n]) => (m < -ERROR||n < -ERROR)?[0, 0]:[m, n])
        const filteredD = distantBetween.map(([dx, dy], i) => (!found2.flat().includes(i))?[dx, dy]:[0,0]).map(([dx, dy]) => [dx<ERROR?0:dx, dy<ERROR?0:dy])

        for (let j = 0; j < filteredD.length; j++) {
            const [ dx, dy ] = filteredD[j]
            if (dx == 0 && dy == 0) continue
            if (dy > 0) continue

            const k = filteredD.findIndex(([ddx, ddy]) => proximatelyEqual(ddx, dx*2, ERROR*2)&&ddy==dy)

            if (k == -1) continue

            let foundPixel = false
            for (let l = 0; l < filteredD.length; l++) {
                const [ dx2, dy2 ] = filteredD[l]
                if (dx2 == 0 && dy2 == 0) continue
                if (dx2 > 0) continue

                const m = filteredD.findIndex(([ddx, ddy]) => proximatelyEqual(ddx, dx, ERROR)&&proximatelyEqual(ddy, dy2, ERROR))

                if (m != -1) {
                    found2.push([i, j, k, l, m])
                    foundPixel = true
                    break
                }
            }
            if (foundPixel) break
        }
    })

    console.timeEnd('filter points')
    console.time('tesseract')

    // console.log(JSON.stringify(found2))

    const tagStrs = await (async () => {
        for (let i = 0; i < found2.length; i++) {
            const set = found2[i]

            const [ dw, dh ] = [ found[set[1]][0] - found[set[0]][0], found[set[3]][1] - found[set[0]][1] ]
            const [ tagW, tagH ] = [Math.floor(dw*0.85), Math.floor(dh*0.68)]
            if (tagW <= ERROR*2 || tagH <= ERROR*2) continue
            const foundStrs = (await Promise.all(set.map(async (idx, j) => {
                const [ x, y ] = found[idx]

                const tag = await image.clone()
                    .threshold()
                    .extract({left:x+ERROR, top:y+ERROR, width:tagW-ERROR*2, height:tagH-ERROR*2})
                    .toBuffer()

                const { data: { text } } = await scheduler.addJob('recognize', tag)
                const tagStr = text.replace(/\s/g, '')

                // console.log(tagStr)

                const correctedStr = existTags.find(t => stringProximatelyEqual(t, tagStr,1))
                if (correctedStr) {
                    return {simp: await t2s.convertPromise(correctedStr), trad: correctedStr}
                }
                return null
            }))).flatMap(x => x?[x]:[])
            if (foundStrs.length > 0) {
                return foundStrs
            }
        }
        return []
    })()


    console.timeEnd('tesseract')

    if (tagStrs.length == 0) {
        return null
    }
    console.log(`found tags: ${tagStrs.map(({trad})=> trad).join(', ')}`)
    const list = combinations(tagStrs).toReversed().flatMap(comb => {
        const matchOps = existTWOperators.filter(op => comb.every(({simp: tag}) => op.tags.includes(tag))&&!booleanXOR(op.rarity==6, comb.map(({trad: tag}) => tag).includes('高級資深幹員')))
        const minRarity = Math.min(...matchOps.map(op => op.rarity))
        const maxRarity = Math.max(...matchOps.map(op => op.rarity))
        if (matchOps.length > 0 && (minRarity >= 4 || maxRarity <= 2)) {
            return [{comb, ops: matchOps}]
        }
        return []
    }).toSorted((a, b) => cal(b) - cal(a))

    console.time('composite')
    console.log(`compositing image...`)

    if (list.length == 0) {
        return {tags: tagStrs.map(({trad})=> trad)}
    }

    const outputWidth = 90 * Math.min(COLUMN_COUNT, Math.max(...list.map(({ops}) => ops.length)))
    const output = await sharp({
        create: {
            width: outputWidth,
            height: list.map(({ops}) => Math.ceil(ops.length / COLUMN_COUNT)).reduce((acc, cur) => acc+cur, 0) * 90+list.length*30,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
    .png().toBuffer()

    const BufferRecord: Record<string, Buffer> = {}

    // for (let i = 0; i < list.length; i++) {
    const combImages = await Promise.all(list.map(async ({comb, ops}, i) => {
        const modOps = Object.assign(ops, {startedRow: list.slice(0, i).map(({ops}) => Math.ceil(ops.length / COLUMN_COUNT)).reduce((acc, cur) => acc+cur, 0)})
        const images = await Promise.all(modOps.map(async (op, j) => {
            const opImageName = `头像_${op.name}.png`
            const md5 = CryptoJS.MD5(opImageName).toString()
            const opImageUrl = `https://prts.wiki/images/${md5.slice(0, 1)}/${md5.slice(0, 2)}/${opImageName}`
            const opImageBuffer = await (async () => {
                for (let i = 0; i < MAX_RETRY_COUNT; i++) {
                    try {
                        return Buffer.from(await (await fetch(opImageUrl)).arrayBuffer())
                    }
                    catch {
                        console.error(`Failed to fetch link: ${opImageUrl}, Retrying... ${i+1}/${MAX_RETRY_COUNT}`)
                    }
                }
            })() || addText(op.name, 90)
            let opImageResizeBuffer
            try {
                if (BufferRecord[op.name]) {

                }
                opImageResizeBuffer = await sharp(opImageBuffer).resize(90, 90).toBuffer()
            } catch (error) {
                opImageResizeBuffer = addText(op.name, 90)
                console.error(error)
                console.error(opImageName)
                console.error(opImageUrl)
            }
            return {input: opImageResizeBuffer, left: (j % COLUMN_COUNT)*90, top: (Math.floor(j / COLUMN_COUNT)+modOps.startedRow)*90+(i+1)*30}
            // return await sharp(output).composite([
            //     {input: opImage, left: (j % COLUMN_COUNT)*90, top: (Math.floor(j / COLUMN_COUNT)+modOps.startedRow)*90}
            // ]).toBuffer()
        }))
        images.push({input: addText(comb.map(({trad}) => trad).join(', '), outputWidth), left: 0, top: modOps.startedRow*90+i*30})

        const combImageBuffer = await sharp(output).composite(images).toBuffer()
        return {input: combImageBuffer, left: 0, top: 0}
    }))
    const outputBuffer = await sharp(output).negate().composite(combImages).toBuffer()

    console.timeEnd('composite')
    console.timeEnd('total spend')
    console.log('--------------------')

    return {tags: tagStrs.map(({trad}) => trad), buffer: outputBuffer}
}


const existTags = [
    "近衛幹員", "狙擊幹員", "重裝幹員",     "醫療幹員", "輔助幹員", "術師幹員", "特種幹員", "先鋒幹員",
    "近戰位",   "遠程位",   "高級資深幹員", "控場",     "爆發",     "資深幹員", "治療",     "支援",
    "新手",     "費用回覆", "輸出",         "生存",     "群攻",     "防護",     "減速",     "削弱",
    "快速復活", "位移",     "召喚",         "支援機械", "男性幹員", "女性幹員",
]
const html = await (await fetch('https://wiki.biligame.com/arknights/公开招募工具')).text()
const existTWOperators = [
    {name: 'Lancet-2',      special: true},
    {name: 'Castle-3',      special: true},
    {name: 'THRM-EX',       special: true},
    {name: '正义骑士号',    special: true},

    {name: '夜刀',          special: true},
    {name: '黑角',          special: true},
    {name: '巡林者',        special: true},
    {name: '杜林',          special: true},
    {name: '12F',           special: true},

    {name: '安德切尔',      special: true},
    {name: '芬',            special: false},
    {name: '香草',          special: false},
    {name: '翎羽',          special: false},
    {name: '玫兰莎',        special: false},
    {name: '米格鲁',        special: false},
    {name: '克洛丝',        special: false},
    {name: '炎熔',          special: false},
    {name: '芙蓉',          special: false},
    {name: '安赛尔',        special: false},
    {name: '史都华德',      special: false},
    {name: '梓兰',          special: false},
    {name: '空爆',          special: false},
    {name: '月见夜',        special: false},
    {name: '泡普卡',        special: false},
    {name: '斑点',          special: false},

    {name: '艾丝黛尔',      special: true},
    // {name: '清流',          special: true},
    {name: '夜烟',          special: false},
    {name: '远山',          special: false},
    {name: '杰西卡',        special: false},
    {name: '流星',          special: false},
    {name: '白雪',          special: false},
    {name: '清道夫',        special: false},
    {name: '红豆',          special: false},
    {name: '杜宾',          special: false},
    {name: '缠丸',          special: false},
    {name: '霜叶',          special: false},
    {name: '慕斯',          special: false},
    {name: '砾',            special: false},
    {name: '暗索',          special: false},
    {name: '末药',          special: false},
    {name: '调香师',        special: false},
    {name: '角峰',          special: false},
    {name: '蛇屠箱',        special: false},
    {name: '古米',          special: false},
    {name: '地灵',          special: false},
    {name: '阿消',          special: false},
    {name: '猎蜂',          special: false},
    {name: '格雷伊',        special: false},
    {name: '苏苏洛',        special: false},
    {name: '桃金娘',        special: false},
    {name: '红云',          special: false},
    {name: '梅',            special: false},
    {name: '安比尔',        special: false},
    {name: '宴',            special: false},
    {name: '刻刀',          special: false},
    {name: '波登可',        special: false},
    {name: '卡达',          special: false},
    // {name: '孑',            special: false},
    // {name: '酸糖',          special: false},
    // {name: '芳汀',          special: false},
    {name: '因陀罗',        special: true},
    {name: '火神',          special: true},
    {name: '白面鸮',        special: false},
    {name: '凛冬',          special: false},
    {name: '德克萨斯',      special: false},
    {name: '幽灵鲨',        special: false},
    {name: '蓝毒',          special: false},
    {name: '白金',          special: false},
    {name: '陨星',          special: false},
    {name: '梅尔',          special: false},
    {name: '赫默',          special: false},
    {name: '华法琳',        special: false},
    {name: '临光',          special: false},
    {name: '红',            special: false},
    {name: '雷蛇',          special: false},
    {name: '可颂',          special: false},
    {name: '普罗旺斯',      special: false},
    {name: '守林人',        special: false},
    {name: '崖心',          special: false},
    {name: '初雪',          special: false},
    {name: '真理',          special: false},
    {name: '狮蝎',          special: false},
    {name: '食铁兽',        special: false},
    {name: '夜魔',          special: false},
    {name: '诗怀雅',        special: false},
    {name: '格劳克斯',      special: false},
    {name: '星极',          special: false},
    {name: '送葬人',        special: false},
    {name: '槐琥',          special: false},
    {name: '灰喉',          special: false},
    {name: '苇草',          special: false},
    {name: '布洛卡',        special: false},
    {name: '吽',            special: false},
    {name: '惊蛰',          special: false},
    {name: '慑砂',          special: false},
    {name: '巫恋',          special: false},
    {name: '极境',          special: false},
    {name: '石棉',          special: false},
    {name: '月禾',          special: false},
    {name: '莱恩哈特',      special: false},
    {name: '断崖',          special: false},
    // {name: '安哲拉',        special: false},
    // {name: '贾维',          special: false},
    // {name: '蜜蜡',          special: false},
    // {name: '燧石',          special: false},
    {name: '能天使',        special: false},
    {name: '推进之王',      special: false},
    {name: '伊芙利特',      special: false},
    {name: '闪灵',          special: false},
    {name: '夜莺',          special: false},
    {name: '星熊',          special: false},
    {name: '塞雷娅',        special: false},
    {name: '银灰',          special: false},
    {name: '斯卡蒂',        special: false},
    {name: '陈',            special: false},
    {name: '黑',            special: false},
    {name: '赫拉格',        special: false},
    {name: '麦哲伦',        special: false},
    {name: '莫斯提马',      special: false},
    {name: '煌',            special: false},
    {name: '阿',            special: false},
    {name: '刻俄柏',        special: false},
    {name: '风笛',          special: false},
    {name: '傀影',          special: false},
    {name: '温蒂',          special: false},
    {name: '早露',          special: false},
    {name: '铃兰',          special: false},
    // {name: '棘刺',          special: false},
    // {name: '森蚺',          special: false},
].map((op) => {
    const regex = RegExp(`data-param1="([^"]+)".*\\n.*title="${op.name}"`)
    const match = html.match(regex)?.[1]
    if (!match) return null
    const m = match.split(',')
    return Object.assign(op, { rarity: Number(m[2]), tags: m.map((tag, i) => tag.trim()+(i==0?'干员':'')).filter(tag => tag&&isNaN(Number(tag))) })
}).flatMap(op => op?[op]:[]) // use flatMap instead of filter to tell dumb typescript that the null is gone
    .toSorted((a, b) => (a?.rarity??0) - (b?.rarity??0)).toReversed()