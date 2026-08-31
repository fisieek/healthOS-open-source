import React from "react";

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  if (!content) return null;
  // Rozdzielamy na linie i parsujemy bloki
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let currentTable: { headers: string[]; rows: string[][] } | null = null;
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushTable = (key: string) => {
    if (!currentTable) return null;
    const table = (
      <div key={key} className="overflow-x-auto my-3 border border-[#2a2d26] rounded-lg">
        <table className="min-w-full divide-y divide-[#2a2d26] text-left text-sm text-[#d1d5db]">
          <thead className="bg-[#1a1c18] text-xs font-semibold text-[#bce663] uppercase">
            <tr>
              {currentTable.headers.map((h, i) => (
                <th key={i} className="px-4 py-2 border-r border-[#2a2d26] last:border-r-0">
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2d26] bg-[#10120f]">
            {currentTable.rows.map((row, i) => (
              <tr key={i} className="hover:bg-[#1a1c18]/50">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 border-r border-[#2a2d26] last:border-r-0">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    currentTable = null;
    return table;
  };

  const flushList = (key: string) => {
    if (!currentList) return null;
    const list = currentList.type === "ul" ? (
      <ul key={key} className="list-disc list-inside ml-4 my-2 space-y-1 text-[#d1d5db]">
        {currentList.items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    ) : (
      <ol key={key} className="list-decimal list-inside ml-4 my-2 space-y-1 text-[#d1d5db]">
        {currentList.items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ol>
    );
    currentList = null;
    return list;
  };

  function renderInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let temp = text;

    // Obsługa pogrubienia **text** i kodu `code` i kursywy *text*
    // Robimy prostą tokenizację przy użyciu regex
    const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
    const splitParts = temp.split(regex);

    splitParts.forEach((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        parts.push(<strong key={index} className="font-bold text-[#bce663]">{part.slice(2, -2)}</strong>);
      } else if (part.startsWith("`") && part.endsWith("`")) {
        parts.push(
          <code key={index} className="bg-[#242721] px-1.5 py-0.5 rounded text-xs font-mono text-[#bce663]">
            {part.slice(1, -1)}
          </code>
        );
      } else if (part.startsWith("*") && part.endsWith("*")) {
        parts.push(<em key={index} className="italic">{part.slice(1, -1)}</em>);
      } else {
        parts.push(part);
      }
    });

    return parts;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 1. Obsługa tabeli: line zaczyna się od '|'
    if (line.startsWith("|")) {
      if (currentList) {
        elements.push(flushList(`list-${i}`));
      }

      const cells = line.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Ignorujemy linie rozdzielające typu |---|---|
      const isSeparator = cells.every(c => c.startsWith("-") || c.match(/^:+$/));
      
      if (isSeparator) {
        continue;
      }

      if (!currentTable) {
        currentTable = { headers: cells, rows: [] };
      } else {
        currentTable.rows.push(cells);
      }
      continue;
    }

    // Jeśli skończyła się tabela, wypychamy ją
    if (currentTable && !line.startsWith("|")) {
      elements.push(flushTable(`table-${i}`));
    }

    // 2. Obsługa list
    const ulMatch = line.match(/^[-*]\s+(.*)/);
    const olMatch = line.match(/^(\d+)\.\s+(.*)/);

    if (ulMatch) {
      if (!currentList || currentList.type !== "ul") {
        if (currentList) elements.push(flushList(`list-prev-${i}`));
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    if (olMatch) {
      if (!currentList || currentList.type !== "ol") {
        if (currentList) elements.push(flushList(`list-prev-${i}`));
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(olMatch[2]);
      continue;
    }

    // Jeśli skończyła się lista, wypychamy ją
    if (currentList && !ulMatch && !olMatch) {
      elements.push(flushList(`list-${i}`));
    }

    // 3. Nagłówki
    if (line.startsWith("#")) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const text = line.replace(/^#+\s+/, "");
      
      if (level === 1) {
        elements.push(<h2 key={i} className="text-xl font-bold text-[#bce663] mt-4 mb-2">{renderInline(text)}</h2>);
      } else if (level === 2) {
        elements.push(<h3 key={i} className="text-lg font-bold text-[#bce663] mt-3 mb-2">{renderInline(text)}</h3>);
      } else {
        elements.push(<h4 key={i} className="text-md font-semibold text-[#bce663] mt-2 mb-1">{renderInline(text)}</h4>);
      }
      continue;
    }

    // 4. Blok kodu (prosty)
    if (line.startsWith("```")) {
      // Szukamy końca bloku kodu
      let codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-[#10120f] border border-[#2a2d26] p-3 rounded-lg overflow-x-auto font-mono text-xs text-left my-3 text-[#d1d5db]">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // 5. Pusta linia / nowy akapit
    if (line === "") {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // 6. Zwykły akapit tekstu
    elements.push(<p key={i} className="my-1 text-sm leading-relaxed text-[#d1d5db]">{renderInline(line)}</p>);
  }

  // Flush w razie gdyby plik kończył się tabelą lub listą
  if (currentTable) {
    elements.push(flushTable("table-end"));
  }
  if (currentList) {
    elements.push(flushList("list-end"));
  }

  return <div className="space-y-1.5">{elements}</div>;
}
