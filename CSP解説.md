# CSP（Content Security Policy）とは？

## 🛡️ CSPの基本概念

**CSP（Content Security Policy）** は、Webサイトのセキュリティを強化するためのブラウザのセキュリティ機能です。

### 簡単に言うと
「このWebサイトでは、どこから来たリソース（画像、スクリプト、スタイルシートなど）を読み込んでもよいか」をあらかじめ決めておく仕組みです。

### なぜ必要なのか
**主な目的：XSS（クロスサイトスクリプティング）攻撃の防止**

```html
<!-- 悪意のあるスクリプトが注入された例 -->
<img src="x" onerror="alert('あなたのデータが盗まれました！')">
```

CSPがあると、このような悪意のあるスクリプトの実行をブラウザが自動的にブロックします。

## 🔧 CSPの設定方法

### 1. HTTPヘッダーで設定
```http
Content-Security-Policy: default-src 'self'; img-src 'self' data:; script-src 'self'
```

### 2. HTMLのmetaタグで設定
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; img-src 'self' data:; script-src 'self'">
```

## 📋 主要なディレクティブ（設定項目）

| ディレクティブ | 説明 | 例 |
|---|---|---|
| `default-src` | すべてのリソースのデフォルト設定 | `default-src 'self'` |
| `script-src` | JavaScriptファイルの読み込み制限 | `script-src 'self' 'unsafe-inline'` |
| `img-src` | 画像ファイルの読み込み制限 | `img-src 'self' data: https:` |
| `style-src` | CSSファイルの読み込み制限 | `style-src 'self' 'unsafe-inline'` |
| `connect-src` | Ajax、WebSocketなどの通信制限 | `connect-src 'self' https://api.example.com` |

## 🎯 kintone_base64_viewerでの影響

### 問題となるケース
```javascript
// Base64画像を表示する際のコード
img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
```

### CSPが厳格な場合の制限
```http
Content-Security-Policy: img-src 'self'
```
👆 この設定だと `data:` URLが許可されていないため、Base64画像が表示されません！

### 正しい設定
```http
Content-Security-Policy: img-src 'self' data:
```
👆 `data:` を追加することで、Base64画像の表示が可能になります。

## 💡 具体的な例で理解

### 例1：厳格なCSP設定
```http
Content-Security-Policy: default-src 'self'
```

**この設定の場合：**
- ✅ 同じドメインの画像：表示される
- ❌ data: URL（Base64画像）：ブロックされる
- ❌ 外部サイトの画像：ブロックされる
- ❌ インラインJavaScript：実行されない

### 例2：Base64画像を許可する設定
```http
Content-Security-Policy: default-src 'self'; img-src 'self' data:
```

**この設定の場合：**
- ✅ 同じドメインの画像：表示される
- ✅ data: URL（Base64画像）：表示される
- ❌ 外部サイトの画像：ブロックされる

### 例3：より柔軟な設定
```http
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'
```

## 🚨 kintoneでのCSP注意事項

### kintoneの標準CSP設定
kintoneは独自のCSP設定を持っています：

```http
Content-Security-Policy: 
  default-src 'self' *.cybozu.com *.kintone.com;
  img-src 'self' data: *.cybozu.com *.kintone.com;
  script-src 'self' 'unsafe-inline' 'unsafe-eval' *.cybozu.com *.kintone.com;
```

### kintone_base64_viewerへの影響
✅ **良いニュース：** kintoneは `img-src` に `data:` を含んでいるため、Base64画像は表示可能です！

### 注意すべきポイント
1. **企業独自のCSP設定**
   - 企業がkintoneにさらに厳格なCSP設定を追加している可能性
   
2. **将来的な変更**
   - kintoneのCSP設定が将来変更される可能性

## 🔍 CSP違反の確認方法

### ブラウザの開発者ツールで確認
```
Console → Error messages
```

**CSP違反のエラー例：**
```
Content Security Policy: The page's settings blocked the loading of a resource at data:image/png;base64,... ("img-src").
```

### JavaScriptでの事前チェック
```javascript
// CSP互換性チェック関数
function checkCSPCompatibility() {
  try {
    // 小さなテスト画像でdata: URLをテスト
    const testImg = new Image();
    testImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    
    // エラーが発生しなければCSPは問題なし
    return true;
  } catch (error) {
    console.warn('CSP制限により画像表示ができない可能性があります');
    return false;
  }
}
```

## 🛠️ 対応策

### 1. 事前チェックの実装
```javascript
// アプリ初期化時にCSPチェック
kintone.events.on('app.record.detail.show', function(event) {
  if (!checkCSPCompatibility()) {
    // CSPが厳格な場合の代替処理
    showAlternativeMessage();
    return event;
  }
  
  // 通常の画像表示処理
  processBase64Image();
  return event;
});
```

### 2. エラーハンドリングの強化
```javascript
function displayBase64Image(base64Data) {
  const img = new Image();
  
  img.onerror = function() {
    // CSP違反の可能性を考慮したエラーメッセージ
    showErrorMessage('画像を表示できません。セキュリティ設定により制限されている可能性があります。');
  };
  
  img.onload = function() {
    // 正常に表示
    appendImageToSpace(img);
  };
  
  img.src = 'data:image/png;base64,' + base64Data;
}
```

### 3. 管理者向けガイドの提供
```markdown
## 管理者向け：CSP設定確認項目

kintone_base64_viewerを使用する場合は、以下の設定が必要です：

**必要なCSP設定：**
```
img-src 'self' data:
```

**確認方法：**
1. ブラウザの開発者ツールを開く
2. Base64画像を表示しようとする
3. Console にCSPエラーが表示されないか確認
```

## 📊 まとめ

### CSPとは
- Webサイトのセキュリティを強化する仕組み
- XSS攻撃を防ぐために、読み込み可能なリソースを制限

### kintone_base64_viewerでの重要性
- Base64画像の表示には `img-src data:` の許可が必要
- kintoneの標準設定では問題ないが、企業独自の設定で制限される可能性

### 対応すべきこと
1. **事前チェック機能の実装**
2. **適切なエラーハンドリング**
3. **管理者向けガイドの提供**

CSPは難しい概念に見えますが、「Webサイトのセキュリティルール」と考えれば理解しやすくなります。kintone_base64_viewerでは、特に画像表示に関するルールが重要になります。