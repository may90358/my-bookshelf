const { Client } = require('@notionhq/client');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID.replace(/-/g, '');

async function fetchBooks() {
  try {
    console.log(`🚀 開始同步過程...`);
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: { property: 'Reading Status', select: { equals: 'Finished' } }
    });

    console.log(`已找到 ${response.results.length} 本讀完的書。`);

    const books = await Promise.all(response.results.map(async (page, index) => {
      const p = page.properties;
      const pageId = page.id;

      // 🔍 偵錯：印出所有屬性名稱，看看標題到底藏在哪
      if (index === 0) console.log("屬性清單:", Object.keys(p));

      // 1. 嘗試多種方式抓取書名
      let pageTitle = "無標題";
      const titleProp = Object.values(p).find(prop => prop.type === 'title');
      if (titleProp && titleProp.title.length > 0) {
        pageTitle = titleProp.title[0].plain_text;
      }
      console.log(`正在處理書籍: ${pageTitle}`);

      // 2. 抓取評論 (心得)
      let commentText = "";
      try {
        const commentsRes = await notion.comments.list({ block_id: pageId });
        console.log(`${pageTitle} 有 ${commentsRes.results.length} 則評論`);
        commentText = commentsRes.results.map(c => c.rich_text.map(t => t.plain_text).join('')).join('\n');
      } catch (e) { console.log(`${pageTitle} 評論抓取失敗: ${e.message}`); }

      // 3. 抓取內容區塊 (金句)
      let highlights = "";
      try {
        const blocksRes = await notion.blocks.children.list({ block_id: pageId });
        console.log(`${pageTitle} 有 ${blocksRes.results.length} 個內容區塊`);
        highlights = blocksRes.results
          .filter(block => ['callout', 'quote', 'paragraph', 'bulleted_list_item'].includes(block.type))
          .map(block => {
            const type = block.type;
            const textArr = block[type].rich_text;
            return textArr ? textArr.map(t => t.plain_text).join('') : "";
          })
          .filter(t => t.trim().length > 1)
          .join('\n\n');
      } catch (e) { console.log(`${pageTitle} 區塊抓取失敗: ${e.message}`); }

      const fullNote = `【我的心得】\n${commentText || '無紀錄'}\n\n【劃線金句】\n${highlights || '無紀錄'}`;

      return {
        title: pageTitle,
        author: p['Author']?.rich_text[0]?.plain_text || '未知作者',
        rating: p['Rating']?.select?.name || '★★★★★',
        year: p['Date Finished']?.date?.start ? new Date(p['Date Finished'].date.start).getFullYear() : 2026,
        color: ['#2c3e50', '#c0392b', '#27ae60', '#2980b9', '#8e44ad'][index % 5],
        note: fullNote,
        height: 190,
        width: 40
      };
    }));

    fs.writeFileSync('books.json', JSON.stringify(books, null, 2));
    console.log(`✅ books.json 已更新！`);
  } catch (error) {
    console.error('❌ 執行過程出錯:', error.message);
    process.exit(1);
  }
}

fetchBooks();
