import { AdvancedSankeyAnimation } from "@/components/AdvancedSankeyAnimation"

export default function SankeyPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Campaign Performance Flow</h1>
      <AdvancedSankeyAnimation />
    </div>
  )
}
