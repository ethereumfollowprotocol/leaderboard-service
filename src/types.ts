export type Address = `0x${string}`

export type CountRow = {
  address: Address
  ens_name: string
  ens_avatar: string
  mutuals_rank: number
  followers_rank: number
  following_rank: number
  blocks_rank: number
  mutuals: number
  followers: number
  following: number
  blocks: number
}

export type LeaderBoardRow = {
  address: Address
  name: string | undefined
  avatar: string | undefined
  mutuals_rank: number
  followers_rank: number
  following_rank: number
  blocks_rank: number
  mutuals: number
  following: number
  followers: number
  blocks: number
}

export type ENSProfile = {
  name: string
  address: Address
  avatar?: string
  updated_at?: string
}

export type ENSProfileResponse = ENSProfile & { type: 'error' | 'success' }
