const { Client } = require('@notionhq/client');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID.replace(/-/g, '');

async function fetchBooks() {
  try {
    console.log(`🚀 開始抓取書籍資料 (包含精裝封面)...`);
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: { property: 'Reading Status', select: { equals: 'Finished' } }
    });

    const books = await Promise.all(response.results.map(async (page, index) => {
      const p = page.properties;
      const pageId = page.id;

      // --- [新增部分] 抓取 Notion 頁面最上方的背景封面 (Cover) ---
      let coverImageUrl = null;
      if (page.cover) {
        if (page.cover.type === 'external') {
          coverImageUrl = page.cover.external.url;
        } else if (page.cover.type === 'file') {
          coverImageUrl = page.cover.file.url; // ⚠️ 注意：Notion file URL 有時效性，如果是上傳的圖片，建議在 Notion 頁面內改用外部連結。
        }
      }
      // console.log(`已抓取封面: ${coverImageUrl ? '有' : '無'}`);

      // 1. 抓取書名
      const titleProp = Object.values(p).find(prop => prop.type === 'title');
      const pageTitle = titleProp && titleProp.title.length > 0 ? titleProp.title[0].plain_text : "無標題";

      // 2. 抓取評論 (心得)
      let commentText = "";
      try {
        const commentsRes = await notion.comments.list({ block_id: pageId });
        commentText = commentsRes.results.map(c => c.rich_text.map(t => t.plain_text).join('')).join('\n');
      } catch (e) {}

      // 3. 抓取金句
      let highlights = "";
      try {
        const blocksRes = await notion.blocks.children.list({ block_id: pageId });
        highlights = blocksRes.results
          .filter(block => ['callout', 'quote', 'paragraph', 'bulleted_list_item'].includes(block.type))
          .map(block => {
            const type = block.type;
            const textArr = block[type].rich_text;
            return textArr ? textArr.map(t => t.plain_text).join('') : "";
          })
          .filter(t => t.trim().length > 1)
          .join('\n\n');
      } catch (e) {}

      const fullNote = `【我的心得】\n${commentText || '無紀錄'}\n\n【劃線金句】\n${highlights || '無紀錄'}`;

      return {
        title: pageTitle,
        // --- [新增部分] 將封面網址塞入 JSON ---
        cover: coverImageUrl, 
        author: p['Author']?.rich_text[0]?.plain_text || '未知作者',
        rating: p['Rating']?.select?.name || '★★★★★',
        year: p['Date Finished']?.date?.start ? new Date(p['Date Finished'].date.start).getFullYear() : 2026,
        // 書脊隨機顏色，這部分保持不變
        color: ['#2c3e50', '#c0392b', '#27ae60', '#2980b9', '#8e44ad'][index % 5],
        note: fullNote,
        height: 180 + Math.floor(Math.random() * 50),
        width: 35 + Math.floor(Math.random() * 15)
      };
    }));

    fs.writeFileSync('books.json', JSON.stringify(books, null, 2));
    console.log(`✅ books.json 已更新 (包含精裝封面資料)！`);
  } catch (error) {
    console.error('❌ 抓取失敗:', error.message);
    process.exit(1);
  }
}

fetchBooks();
