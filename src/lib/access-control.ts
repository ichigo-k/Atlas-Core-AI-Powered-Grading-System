import { isIP } from "node:net"

function ipv4Number(value: string) {
  return value.split(".").reduce((result, part) => (result << 8) + Number(part), 0) >>> 0
}

function ipv6Number(value: string) {
  const halves = value.toLowerCase().split("::")
  const left = halves[0] ? halves[0].split(":") : []
  const right = halves[1] ? halves[1].split(":") : []
  const groups = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left
  if (groups.length !== 8) return null
  try { return groups.reduce((result, group) => (result << BigInt(16)) + BigInt(`0x${group || "0"}`), BigInt(0)) } catch { return null }
}

export function validCidr(value: string) {
  const [address, prefixText] = value.trim().split("/")
  const version = isIP(address)
  if (!version) return false
  if (prefixText === undefined) return true
  const prefix = Number(prefixText)
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= (version === 4 ? 32 : 128)
}

export function ipMatchesCidr(ip: string, cidr: string) {
  const cleanIp = ip.replace(/^::ffff:/, "")
  const [network, prefixText] = cidr.trim().split("/")
  if (cleanIp === network) return true
	const version = isIP(cleanIp)
	if (version !== isIP(network)) return false
  const prefix = prefixText === undefined ? 32 : Number(prefixText)
	if (version === 6) {
		const ipValue = ipv6Number(cleanIp)
		const networkValue = ipv6Number(network)
		if (ipValue == null || networkValue == null) return false
		const ipv6Prefix = prefixText === undefined ? 128 : Number(prefixText)
		const mask = ipv6Prefix === 0 ? BigInt(0) : ((BigInt(1) << BigInt(ipv6Prefix)) - BigInt(1)) << BigInt(128 - ipv6Prefix)
		return (ipValue & mask) === (networkValue & mask)
	}
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (ipv4Number(cleanIp) & mask) === (ipv4Number(network) & mask)
}

export function requestIp(headers: Headers) {
  return (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "").trim()
}
