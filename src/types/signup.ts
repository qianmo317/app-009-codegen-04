// 报名本子相关数据模型

/** 一期课要准备的线材（每人一份） */
export type YarnItem = {
  id: string;
  /** 线材名称，如「中粗羊毛线 · 酒红」 */
  name: string;
  /** 数量，如「2 团」 */
  amount: string;
  /** 备注，如「配 4.5mm 棒针」 */
  note?: string;
};

/**
 * 退费档位：开课前 ≥ daysBefore 整天（24 小时）取消时，退 percent%。
 * 档位按 daysBefore 从大到小匹配，没有任何档位命中则不退（0%）。
 * 例：[{daysBefore:7,percent:100},{daysBefore:3,percent:50}]
 *   —— 提前 7 天以上全退，提前 3~6 天退一半，不足 3 天不退。
 */
export type RefundTier = {
  daysBefore: number;
  percent: number;
};

/**
 * enrolled  已占名额（正式名单）
 * waitlist  候补排队（爽约少的、报名早的排前面）
 * cancelled 已退出（正式名单退出时记录退费比例，并触发候补递补）
 * attended  已上课（点名后）
 * noshow    爽约（点名后，同时给学员累计一次爽约）
 */
export type RegistrationStatus = 'enrolled' | 'waitlist' | 'cancelled' | 'attended' | 'noshow';

export type Registration = {
  id: string;
  classId: string;
  personId: string;
  /** 姓名快照，便于直接展示 */
  personName: string;
  /** 联系方式快照 */
  contact: string;
  status: RegistrationStatus;
  /** 报名（进入候补）时间，先到先得与候补排序都用它 */
  createdAt: number;
  /** 从候补补成正式名额的时间 */
  promotedAt?: number;
  cancelledAt?: number;
  /** 退出时适用的退费比例（0-100），候补退出为空 */
  refundPercent?: number;
};

/** 学员档案：爽约次数跨期累计 */
export type Person = {
  id: string;
  name: string;
  contact: string;
  noShowCount: number;
  createdAt: number;
};

/** 一期毛线编织课 */
export type KnitClass = {
  id: string;
  title: string;
  teacher: string;
  /** 本地时间，datetime-local 格式 'YYYY-MM-DDTHH:mm' */
  startTime: string;
  location: string;
  capacity: number;
  /** 学费（元），用于算退费金额，可为 0 */
  price: number;
  yarns: YarnItem[];
  refundTiers: RefundTier[];
  createdAt: number;
};
