/**
 * Parse PDF file to text using pdf.js (loaded from CDN dynamically).
 * Returns: { text: string, pageCount: number }
 * The text includes page markers like: "[Trang 1]\n..."
 */
export async function parsePdfText(file) {
  return new Promise((resolve, reject) => {
    const PDFJS_CDN =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    const WORKER_CDN =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const doExtract = async (pdfjsLib) => {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const pageCount = pdf.numPages;
        let fullText = "";
        let lineNumber = 1;

        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          const items = (textContent.items || []).filter(
            (it) => it && typeof it.str === "string" && it.transform
          );

          let pageLines = [];
          if (items.length > 0) {
            const xCoords = items.map((it) => it.transform[4]);
            const minX = Math.min(...xCoords);
            const maxX = Math.max(...xCoords);
            const width = maxX - minX;

            let isTwoColumn = false;
            let midX = minX + width / 2;

            if (width > 200) {
              const numSlices = 20;
              const sliceWidth = width / numSlices;
              const sliceCounts = new Array(numSlices).fill(0);

              for (const item of items) {
                const x = item.transform[4];
                const sliceIdx = Math.floor((x - minX) / sliceWidth);
                if (sliceIdx >= 0 && sliceIdx < numSlices) {
                  sliceCounts[sliceIdx]++;
                }
              }

              let leftCount = 0;
              for (let i = 2; i <= 7; i++) leftCount += sliceCounts[i];

              let rightCount = 0;
              for (let i = 12; i <= 17; i++) rightCount += sliceCounts[i];

              let midCount = 0;
              for (let i = 8; i <= 11; i++) midCount += sliceCounts[i];

              if (leftCount > 5 && rightCount > 5 && midCount < (leftCount + rightCount) * 0.15) {
                isTwoColumn = true;
                midX = minX + 10 * sliceWidth;
              }
            }

            const processGroup = (groupItems) => {
              const sorted = [...groupItems].sort((a, b) => b.transform[5] - a.transform[5]);
              const lines = [];
              let currentLine = [];
              let lastY = null;

              for (const item of sorted) {
                const y = item.transform[5];
                if (lastY === null) {
                  currentLine.push(item);
                  lastY = y;
                } else if (Math.abs(y - lastY) <= 8) {
                  currentLine.push(item);
                } else {
                  currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
                  lines.push(currentLine);
                  currentLine = [item];
                  lastY = y;
                }
              }
              if (currentLine.length > 0) {
                currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
                lines.push(currentLine);
              }

              const groupLines = [];
              for (const line of lines) {
                let lineStr = "";
                for (const it of line) {
                  if (lineStr && !lineStr.endsWith(" ") && !it.str.startsWith(" ")) {
                    lineStr += " ";
                  }
                  lineStr += it.str;
                }
                if (lineStr.trim()) groupLines.push(lineStr.trim());
              }
              return groupLines;
            };

            if (isTwoColumn) {
              const sortedItems = [...items].sort((a, b) => b.transform[5] - a.transform[5]);
              const linesGrouped = [];
              let currentLine = [];
              let lastLineY = null;
              for (const item of sortedItems) {
                const y = item.transform[5];
                if (lastLineY === null) {
                  currentLine.push(item);
                  lastLineY = y;
                } else if (Math.abs(y - lastLineY) <= 8) {
                  currentLine.push(item);
                } else {
                  linesGrouped.push(currentLine);
                  currentLine = [item];
                  lastLineY = y;
                }
              }
              if (currentLine.length > 0) {
                linesGrouped.push(currentLine);
              }

              const classifiedLines = linesGrouped.map((lineItems) => {
                lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
                if (lineItems.length <= 1) {
                  return { type: "single", items: lineItems };
                }
                const midLeft = midX - 15;
                const midRight = midX + 15;
                let hasOverlap = false;
                for (const it of lineItems) {
                  const itemLeft = it.transform[4];
                  const itemRight = itemLeft + (it.width || 0);
                  if (itemLeft < midRight && itemRight > midLeft) {
                    hasOverlap = true;
                    break;
                  }
                }
                if (hasOverlap) {
                  return { type: "single", items: lineItems };
                }
                const leftItems = lineItems.filter((it) => it.transform[4] < midX);
                const rightItems = lineItems.filter((it) => it.transform[4] >= midX);
                if (leftItems.length > 0 && rightItems.length > 0) {
                  const rightMostLeft = leftItems[leftItems.length - 1];
                  const leftMostRight = rightItems[0];
                  const gap = leftMostRight.transform[4] - (rightMostLeft.transform[4] + (rightMostLeft.width || 0));
                  if (gap >= 20) {
                    return { type: "two", items: lineItems };
                  }
                }
                return { type: "two", items: lineItems };
              });

              const zones = [];
              let currentZone = null;
              for (const line of classifiedLines) {
                if (!currentZone) {
                  currentZone = { type: line.type, lines: [line.items] };
                } else if (currentZone.type === line.type) {
                  currentZone.lines.push(line.items);
                } else {
                  zones.push(currentZone);
                  currentZone = { type: line.type, lines: [line.items] };
                }
              }
              if (currentZone) {
                zones.push(currentZone);
              }

              const finalLines = [];
              for (const zone of zones) {
                if (zone.type === "single") {
                  for (const lineItems of zone.lines) {
                    let lineStr = "";
                    for (const it of lineItems) {
                      if (lineStr && !lineStr.endsWith(" ") && !it.str.startsWith(" ")) {
                        lineStr += " ";
                      }
                      lineStr += it.str;
                    }
                    if (lineStr.trim()) finalLines.push(lineStr.trim());
                  }
                } else {
                  const allZoneItems = zone.lines.flat();
                  const leftItems = allZoneItems.filter((it) => it.transform[4] < midX);
                  const rightItems = allZoneItems.filter((it) => it.transform[4] >= midX);
                  finalLines.push(...processGroup(leftItems));
                  finalLines.push(...processGroup(rightItems));
                }
              }
              pageLines = finalLines;
            } else {
              pageLines = processGroup(items);
            }
          }

          fullText += `[Trang ${pageNum}]\n`;
          for (const line of pageLines) {
            if (line) {
              fullText += `Dòng ${lineNumber}: ${line}\n`;
              lineNumber++;
            }
          }
          fullText += "\n";
        }

        resolve({ text: fullText.trim(), pageCount });
      } catch (err) {
        reject(err);
      }
    };

    if (window.pdfjsLib) {
      doExtract(window.pdfjsLib);
    } else {
      const script = document.createElement("script");
      script.src = PDFJS_CDN;
      script.onload = () => doExtract(window.pdfjsLib);
      script.onerror = () => reject(new Error("Không thể tải pdf.js"));
      document.head.appendChild(script);
    }
  });
}
