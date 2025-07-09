import { env } from "@app/env"
import Mailosaur from "mailosaur"


const mailosaur = new Mailosaur(env.MAILSOUR_API)


let serverId = ''
void async function () {
    const server = await mailosaur.servers.list()
    if (!server.items?.[0]?.id) return
    serverId = server.items[0].id
}()


export async function latestOTPMsg() {
    const message = await mailosaur.messages.get(serverId, { sentFrom: 'ropenotify@thaiairways.com' })
    const code = message.text?.codes?.[0]?.value
    return code
}