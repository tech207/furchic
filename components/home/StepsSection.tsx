'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ShoppingBag, ClipboardList, Smartphone } from 'lucide-react'

const STEPS = [
  {
    icon: ShoppingBag,
    step: '01',
    title: '選購 NFC 卡',
    desc: '到 Furchic 官網挑選適合您寵物的 NFC 智能卡款式，精緻卡面任您搭配。',
    color: 'bg-orange-100 text-orange-600',
  },
  {
    icon: ClipboardList,
    step: '02',
    title: '設定寵物資料',
    desc: '輸入寵物基本資訊、緊急聯絡人與醫療記錄，完整建立您的毛孩檔案。',
    color: 'bg-amber-100 text-amber-600',
  },
  {
    icon: Smartphone,
    step: '03',
    title: '綁卡即刻守護',
    desc: '將 NFC 卡綁定寵物，任何人只需掃描即可查看授權資訊，守護從此刻起。',
    color: 'bg-red-100 text-red-500',
  },
]

function StepCard({ step, index }: { step: (typeof STEPS)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const Icon = step.icon

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.15, ease: 'easeOut' }}
      className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm transition-shadow hover:shadow-md"
    >
      <div
        className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${step.color}`}
      >
        <Icon className="h-7 w-7" />
      </div>
      <span className="mb-2 text-xs font-bold tracking-widest text-muted-foreground">
        {step.step}
      </span>
      <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {step.desc}
      </p>
    </motion.div>
  )
}

export function StepsSection() {
  return (
    <section className="bg-gray-50 py-20">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-orange-500">
            How it works
          </p>
          <h2 className="text-3xl font-extrabold md:text-4xl">
            三步驟，讓您的寵物更安全
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            簡單三步，輕鬆建立您的毛孩數位身份，隨時隨地守護在側。
          </p>
        </div>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <StepCard key={s.step} step={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
