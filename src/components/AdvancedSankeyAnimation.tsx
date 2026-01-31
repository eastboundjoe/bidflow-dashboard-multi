"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { sankey, sankeyJustify } from "d3-sankey"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

export function AdvancedSankeyAnimation() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [speed, setSpeed] = useState(0.7)
  const [density, setDensity] = useState(7)
  const [totalClicks, setTotalClicks] = useState(0)

  // Animation state
  const particlesRef = useRef<any[]>([])
  const cacheRef = useRef<any>({})
  const animationRef = useRef<number>()
  const elapsedRef = useRef(0)

  useEffect(() => {
    if (!svgRef.current) return

    // Configuration constants
    const width = 960
    const psize = 7
    const margin = { top: 10, right: 130, bottom: 10, left: 10 }
    const bandHeight = 80
    const padding = 20
    const curve = 0.6

    // Simplified raw data - ACOS buckets are now end nodes
    const raw = {
      "+100-71% ACOS": { "ASIN clicks": 45, "KEYWORD clicks": 25 },
      "70-51% ACOS": { "ASIN clicks": 55, "KEYWORD clicks": 35 },
      "50-31% ACOS": { "ASIN clicks": 65, "KEYWORD clicks": 45 },
      "30-16% ACOS": { "ASIN clicks": 75, "KEYWORD clicks": 55 },
      "15-11% ACOS": { "ASIN clicks": 85, "KEYWORD clicks": 65 },
      "10-6% ACOS": { "ASIN clicks": 95, "KEYWORD clicks": 75 },
      "5% under ACOS": { "ASIN clicks": 105, "KEYWORD clicks": 85 },
    }

    // Helper functions for data processing
    const isLeaf = (d: any) => d.hasOwnProperty("ASIN clicks")
    const getChildren = ({ name, ...otherProps }: any) =>
      isLeaf(otherProps) ? undefined : Object.entries(otherProps).map(([name, obj]) => ({ name, ...obj }))

    // Create D3 hierarchy from raw data
    const hierarchy = d3.hierarchy({ name: "Ad Spend", ...raw }, getChildren).each((d) => {
      const absolutePath = (node: any): string => `${node.parent ? absolutePath(node.parent) : ""}/${node.data.name}`
      const datum: any = {
        name: d.data.name,
        path: absolutePath(d),
      }
      if (isLeaf(d.data)) {
        datum.groups = [
          { key: "ASIN clicks", value: d.data["ASIN clicks"] },
          { key: "KEYWORD clicks", value: d.data["KEYWORD clicks"] },
        ]
      }
      d.data = datum
    })

    // Calculate height based on unique leaf nodes (now 7 ACOS buckets)
    const uniqueLeaves = [...new Set(hierarchy.leaves().map((d) => d.data.name))]
    const height = margin.top + margin.bottom + uniqueLeaves.length * (bandHeight + padding / 2) + padding / 2

    // Extract nodes and links for Sankey layout
    const nodes: any[] = ["Ad Spend"]
    const links: any[] = []

    const walkNodes = (node: any) => {
      for (const name in node) {
        nodes.push(name)
        if (!isLeaf(node[name])) {
          walkNodes(node[name])
        }
      }
    }

    const walkLinks = (source: string, sourceNode: any) => {
      for (const name in sourceNode) {
        links.push({ source, target: name })
        if (!isLeaf(sourceNode[name])) {
          walkLinks(name, sourceNode[name])
        }
      }
    }

    walkNodes(raw)
    walkLinks("Ad Spend", raw)

    // Prepare data for Sankey layout
    const dataForSankey = {
      nodes: [...new Set(nodes)].map((name) => ({ name, fixedValue: 1 })),
      links: links.map((l) => ({ ...l, value: 0 })),
    }

    // Create Sankey layout
    const sankeyLayout = sankey()
      .nodeId((d: any) => d.name)
      .nodeAlign(sankeyJustify)
      .nodeWidth(((width - margin.left - margin.right) / (hierarchy.height + 1)) * curve)
      .nodePadding(padding)
      .size([width - margin.left - margin.right, height - margin.top - margin.bottom])

    const sankeyData = sankeyLayout(dataForSankey)

    // Manually align Ad Spend node with the top ACOS node
    const topACOSNode = sankeyData.nodes.find((n: any) => n.name === "+100-71% ACOS")

    const adSpendNode = sankeyData.nodes.find((n: any) => n.name === "Ad Spend")

    if (adSpendNode && topACOSNode) {
      // Align Ad Spend node's vertical position with the top ACOS node
      adSpendNode.y0 = topACOSNode.y0
      adSpendNode.y1 = topACOSNode.y1
    }

    // Generate routes from root to each leaf
    const walkRoutes = (n: any): any[] => {
      const subroutes = n.sourceLinks.flatMap((d: any) => walkRoutes(d.target))
      return subroutes.length ? subroutes.map((r: any) => [n, ...r]) : [[n]]
    }

    const root = sankeyData.nodes.find((d: any) => d.targetLinks.length === 0)
    const routes = walkRoutes(root)

    // Create target data for particle generation
    const targetsAbsolute = hierarchy
      .leaves()
      .flatMap((t) =>
        t.data.groups.map((g: any) => ({ name: t.data.name, path: t.data.path, group: g.key, value: g.value })),
      )

    const totalParticles = d3.sum(targetsAbsolute, (d) => d.value)

    const targets = targetsAbsolute.map((t) => ({ ...t, value: t.value / totalParticles }))

    const thresholds = d3.range(targets.length).map((i) => d3.sum(targets.slice(0, i + 1).map((r) => r.value)))

    const targetScale = d3.scaleThreshold().domain(thresholds).range(targets)

    // Color scale for different groups
    const colorScale = d3.scaleOrdinal().domain(["KEYWORD clicks", "ASIN clicks"]).range(["#22c55e", "#ef4444"])

    // Scales for particle positioning and speed
    const offsetScale = d3.scaleLinear().range([-bandHeight / 2 - psize / 2, bandHeight / 2 - psize / 2])

    const speedScale = d3.scaleLinear().range([speed, speed + 0.5])

    // Get leaf nodes for counters
    const leaves = sankeyData.nodes
      .filter((n: any) => n.sourceLinks.length === 0)
      .map((n: any) => ({
        node: n,
        targets: targetsAbsolute.filter((t) => t.name === n.name),
      }))

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove()

    // Create main SVG
    const svg = d3.select(svgRef.current).attr("viewBox", [0, 0, width, height]).style("overflow", "visible")

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    // Custom Sankey link path generator
    function sankeyLinkCustom(nodes: any[]) {
      const p = d3.path()
      const h = bandHeight / 2
      nodes.forEach((n, i) => {
        if (i === 0) {
          p.moveTo(n.x0, n.y0 + h)
        }
        p.lineTo(n.x1, n.y0 + h)
        const nn = nodes[i + 1]
        if (nn) {
          const w = nn.x0 - n.x1
          p.bezierCurveTo(n.x1 + w / 2, n.y0 + h, n.x1 + w / 2, nn.y0 + h, nn.x0, nn.y0 + h)
        }
      })
      return p.toString()
    }

    // Draw the flow paths
    const route = g
      .append("g")
      .attr("class", "routes")
      .attr("fill", "none")
      .attr("stroke-opacity", 0.1)
      .attr("stroke", "#EEE")
      .selectAll("path")
      .data(routes)
      .join("path")
      .attr("d", sankeyLinkCustom)
      .attr("stroke-width", bandHeight)

    // Cache path points for particle animation
    route.each(function (nodes: any) {
      const path = this as SVGPathElement
      const length = path.getTotalLength()
      const points = d3.range(length).map((l) => {
        const point = path.getPointAtLength(l)
        return { x: point.x, y: point.y }
      })
      const key = "/" + nodes.map((n: any) => n.name).join("/")
      cacheRef.current[key] = { points }
    })

    // Create particle container
    const particlesContainer = g.append("g")

    // Add labels
    g.selectAll(".label")
      .data(sankeyData.nodes)
      .join("g")
      .attr("class", "label")
      .attr("transform", (d: any) => `translate(${d.x1 - bandHeight / 2}, ${d.y0 + bandHeight / 2})`)
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", "end")
      .style("font-family", "monospace")
      .style("font-size", "16px") // Increased font size
      .style("text-transform", "uppercase") // Added uppercase
      .call((label: any) => {
        label
          .append("text")
          .attr("stroke", "white")
          .attr("stroke-width", 3)
          .text((d: any) => d.name)
        label
          .append("text")
          .attr("fill", "#444")
          .text((d: any) => d.name)
      })

    // Add description sentences
    // Sentence 1: Left-aligned, starts at Ad Spend position with embedded counter
    if (adSpendNode) {
      const sentence1Group = g
        .append("g")
        .attr("class", "description-sentence-1")
        .attr("transform", `translate(${adSpendNode.x0}, ${adSpendNode.y0 - 40})`)
        .style("font-family", "monospace")
        .style("font-size", "12px")
        .style("text-transform", "uppercase")
        .style("letter-spacing", 0.7)
        .attr("text-anchor", "start")
        .attr("fill", "black")

      // First line with counter embedded
      const firstLine = sentence1Group.append("g").attr("transform", "translate(0, 0)")

      firstLine.append("text").attr("x", 0).attr("y", 0).text("Follow the number of clicks ")

      // Add the counter in the middle of the sentence
      const counterText = firstLine
        .append("text")
        .attr("class", "embedded-counter")
        .attr("x", 200) // Position after "Follow the number of clicks "
        .attr("y", 0)
        .attr("fill", "#2563eb") // Blue color like the original counter
        .style("font-weight", "bold")
        .style("font-size", "14px")
        .text("0")

      // Second line
      sentence1Group.append("text").attr("y", 15).text("from last weeks Advertising Spend. . .")
    }

    // Sentence 2: Right-aligned, positioned at the end
    const sentence2Group = g
      .append("g")
      .attr("class", "description-sentence-2")
      .attr("transform", `translate(${width - margin.left - 120}, ${leaves[0].node.y0 - 40})`)
      .style("font-family", "monospace")
      .style("font-size", "12px")
      .style("text-transform", "uppercase")
      .style("letter-spacing", 0.7)
      .attr("text-anchor", "end")
      .attr("fill", "black")

    sentence2Group.append("text").attr("y", 0).text(". . .and see their ACOS performance")

    // Add counters
    const counters = g
      .selectAll(".counter")
      .data(leaves)
      .join("g")
      .attr("class", "counter")
      .attr("transform", (d: any) => `translate(${width - margin.left}, ${d.node.y0})`)
      .each(function (leaf: any, i: number) {
        d3.select(this)
          .selectAll(".group")
          .data(["ASIN clicks", "KEYWORD clicks"])
          .join("g")
          .attr("class", "group")
          .attr("transform", (d: any, i: number) => `translate(${-i * 60}, 0)`)
          .attr("text-anchor", "end")
          .style("font-family", "monospace")
          .call(
            (g: any) =>
              i === 0 &&
              g.each(function (d: any) {
                const group = d3.select(this)

                // Add the main label (KEYWORD or ASIN) - increased font size
                group
                  .append("text")
                  .attr("dominant-baseline", "hanging")
                  .attr("fill", "black") // Changed from "#999"
                  .style("font-size", 12) // Increased from 9 to 12
                  .style("text-transform", "uppercase")
                  .style("letter-spacing", 0.7)
                  .attr("y", -20) // Adjusted position for larger font
                  .text(d.split(" ")[0]) // Gets "KEYWORD" or "ASIN"

                // Add "clicks" on the second line - increased font size
                group
                  .append("text")
                  .attr("dominant-baseline", "hanging")
                  .attr("fill", "black") // Changed from "#999"
                  .style("font-size", 12) // Increased from 9 to 12
                  .style("text-transform", "uppercase")
                  .style("letter-spacing", 0.7)
                  .attr("y", -8) // Adjusted position for larger font
                  .text("clicks")
              }),
          )
          .call((g: any) =>
            g
              .append("text")
              .attr("class", "absolute")
              .attr("fill", (d: any) => colorScale(d))
              .attr("font-size", 20)
              .attr("dominant-baseline", "middle")
              .attr("y", bandHeight / 2 - 2)
              .text(0),
          )
          .call((g: any) =>
            g
              .append("text")
              .attr("class", "percent")
              .attr("dominant-baseline", "hanging")
              .attr("fill", "black") // Changed from "#999"
              .attr("font-size", 12) // Increased from 9 to 12
              .attr("y", bandHeight / 2 + 9)
              .text("0%"),
          )
      })

    // Animation functions
    function addParticlesMaybe(t: number) {
      const particlesToAdd = Math.round(Math.random() * density)
      for (let i = 0; i < particlesToAdd && particlesRef.current.length < totalParticles; i++) {
        const target = targetScale(Math.random())
        const length = cacheRef.current[target.path].points.length

        const particle = {
          id: `${t}_${i}`,
          speed: speedScale(Math.random()),
          color: colorScale(target.group),
          offset: offsetScale(Math.random()),
          pos: 0,
          createdAt: t,
          length,
          target,
        }
        particlesRef.current.push(particle)
      }
    }

    function updateCounters() {
      // Count all moving particles for total clicks (independent counter)
      const movingParticles = particlesRef.current.filter((p) => p.pos > 0)
      setTotalClicks(movingParticles.length)

      // Update embedded counter in sentence
      g.select(".embedded-counter").text(movingParticles.length)

      // Count finished particles for individual counters
      counters.each(function (d: any) {
        const finished = particlesRef.current
          .filter((p) => p.target.name === d.node.name)
          .filter((p) => p.pos >= p.length)

        d3.select(this)
          .selectAll(".group")
          .each(function (group: any) {
            const count = finished.filter((p) => p.target.group === group).length
            d3.select(this).select(".absolute").text(count)
            d3.select(this)
              .select(".percent")
              .text(d3.format(".0%")(count / totalParticles))
          })
      })
    }

    function moveParticles(t: number) {
      const nodes = particlesContainer
        .selectAll(".particle")
        .data(particlesRef.current, (d: any) => d.id)
        .join(
          (enter: any) =>
            enter
              .append("rect")
              .attr("class", "particle")
              .attr("opacity", 0.8)
              .attr("fill", (d: any) => d.color)
              .attr("width", psize)
              .attr("height", psize),
          (update: any) => update,
          (exit: any) => exit.remove(),
        )

      nodes.each(function (d: any) {
        const localTime = t - d.createdAt
        d.pos = localTime * d.speed
        const index = Math.floor(d.pos)

        if (d.pos >= d.length) {
          // Particle has finished - keep it at the end
          const lastPoint = cacheRef.current[d.target.path].points[d.length - 1]
          d3.select(this)
            .attr("x", lastPoint.x)
            .attr("y", lastPoint.y + d.offset)
        } else {
          // Particle is still moving
          const coo = cacheRef.current[d.target.path].points[index]
          const nextCoo = cacheRef.current[d.target.path].points[index + 1]

          if (coo && nextCoo) {
            const delta = d.pos - index
            const x = coo.x + (nextCoo.x - coo.x) * delta
            const y = coo.y + (nextCoo.y - coo.y) * delta

            // Particle squeezing effect as they approach the end
            const lastX = cacheRef.current[d.target.path].points[d.length - 1].x
            const squeezeFactor = Math.max(0, psize - (lastX - x))
            const h = Math.max(2, psize - squeezeFactor)
            const dy = (psize - h) / 2
            const w = psize + squeezeFactor
            const dx = squeezeFactor / 2

            d3.select(this)
              .attr("x", x - dx)
              .attr("y", y + d.offset + dy)
              .attr("height", h)
              .attr("width", w)
          }
        }
      })
    }

    function tick(t: number) {
      addParticlesMaybe(t)
      updateCounters()
      moveParticles(t)
    }

    // Start animation loop
    function animate() {
      tick(elapsedRef.current++)
      animationRef.current = requestAnimationFrame(animate)
    }
    animate()

    // Update speed scale when speed changes
    speedScale.range([speed, speed + 0.5])

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [speed, density])

  const handleReset = () => {
    particlesRef.current.length = 0
    elapsedRef.current = 0
    setTotalClicks(0)
    if (svgRef.current) {
      d3.select(svgRef.current).selectAll(".particle").remove()
      d3.select(svgRef.current).selectAll(".absolute").text(0)
      d3.select(svgRef.current).selectAll(".percent").text("0%")
      d3.select(svgRef.current).select(".embedded-counter").text(0)
    }
  }

  return (
    <div className="w-full min-h-[700px] bg-white rounded-lg border shadow-sm">
      <div className="p-4 bg-gray-100 border-b flex items-center gap-4 rounded-t-lg">
        <Button onClick={handleReset} variant="outline">
          Reset
        </Button>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Speed</label>
          <Slider
            value={[speed]}
            onValueChange={(value) => setSpeed(value[0])}
            min={0.1}
            max={2.0}
            step={0.1}
            className="w-32"
          />
          <span className="text-sm w-12">{speed.toFixed(1)}</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Density</label>
          <Slider
            value={[density]}
            onValueChange={(value) => setDensity(value[0])}
            min={1}
            max={15}
            step={1}
            className="w-32"
          />
          <span className="text-sm w-8">{density}</span>
        </div>
      </div>

      <div className="p-4 overflow-auto">
        <svg ref={svgRef} className="w-full min-w-[960px]" style={{ height: "700px" }} />
      </div>
    </div>
  )
}
