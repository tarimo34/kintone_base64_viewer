/**
 * kintone_base64_viewer - セキュリティ強化版
 * Version 3.0 (Security Enhanced)
 * 
 * Base64形式でエンコードされた画像データを安全に表示するkintoneカスタマイズ
 * セキュリティ対策を大幅に強化
 */

(() => {
  'use strict';

  // =============================================================================
  // 設定項目
  // =============================================================================
  
  const CONFIG = {
    fieldCode: 'base64viewer',              // Base64データが入っているフィールドコード
    spaceElement: 'SP_Viewer',              // 画像を表示するスペースのID
    maxBase64Size: 100000,                  // 最大サイズ（約75KB）- 350KBから大幅縮小
    maxConcurrentValidations: 3,            // 同時処理数制限
    imageValidationTimeout: 5000,           // 画像検証タイムアウト（5秒）
    rateLimit: {
      windowMs: 60000,                      // レート制限期間（1分）
      maxRequests: 10                       // 1分間の最大リクエスト数
    }
  };

  // =============================================================================
  // グローバル状態管理
  // =============================================================================
  
  let currentValidationCount = 0;           // 現在の検証処理数
  const userRateLimit = new Map();          // ユーザー別レート制限履歴

  // =============================================================================
  // セキュリティ機能：Base64検証の強化
  // =============================================================================
  
  /**
   * Base64文字列の厳格な検証
   * 4つの検証レイヤーでセキュリティを強化
   */
  function isValidBase64(str) {
    try {
      // 1. 基本的な文字チェック
      if (typeof str !== 'string' || str.length === 0) {
        return false;
      }

      // 2. Base64で使用可能な文字のみかチェック
      if (!/^[A-Za-z0-9+/=]+$/.test(str)) {
        return false;
      }

      // 3. Base64の構造チェック（4の倍数でないとパディングが不正）
      if (str.length % 4 !== 0) {
        return false;
      }

      // 4. パディング文字（=）の位置チェック
      const paddingIndex = str.indexOf('=');
      if (paddingIndex !== -1 && paddingIndex < str.length - 2) {
        return false;
      }

      // 5. デコード/エンコードによる整合性チェック
      const decoded = atob(str);
      const reencoded = btoa(decoded);
      
      return reencoded === str;
      
    } catch (error) {
      // デコードエラーが発生した場合は無効
      return false;
    }
  }

  // =============================================================================
  // セキュリティ機能：サイズ制限とレート制限
  // =============================================================================
  
  /**
   * ファイルサイズの制限チェック
   */
  function checkSizeLimit(base64String) {
    if (base64String.length > CONFIG.maxBase64Size) {
      throw new Error('SIZE_LIMIT_EXCEEDED');
    }
  }

  /**
   * ユーザー単位のレート制限チェック
   */
  function checkRateLimit() {
    try {
      const userId = kintone.getLoginUser().id;
      const now = Date.now();
      const userHistory = userRateLimit.get(userId) || [];
      
      // 制限期間内のリクエストをフィルタ
      const recentRequests = userHistory.filter(
        time => now - time < CONFIG.rateLimit.windowMs
      );
      
      if (recentRequests.length >= CONFIG.rateLimit.maxRequests) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      
      // 新しいリクエストを記録
      recentRequests.push(now);
      userRateLimit.set(userId, recentRequests);
      
    } catch (error) {
      if (error.message === 'RATE_LIMIT_EXCEEDED') {
        throw error;
      }
      // ユーザー情報取得エラーの場合は処理を続行
      console.warn('User information not available for rate limiting');
    }
  }

  /**
   * 同時処理数の制限チェック
   */
  function checkConcurrentLimit() {
    if (currentValidationCount >= CONFIG.maxConcurrentValidations) {
      throw new Error('CONCURRENT_LIMIT_EXCEEDED');
    }
  }

  // =============================================================================
  // セキュリティ機能：CSP互換性チェック
  // =============================================================================
  
  /**
   * CSP（Content Security Policy）の互換性チェック
   */
  function checkCSPCompatibility() {
    try {
      // 小さなテスト画像でdata: URLの可用性をテスト
      const testImg = new Image();
      testImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      return true;
    } catch (error) {
      console.warn('CSP制限により画像表示ができない可能性があります');
      return false;
    }
  }

  // =============================================================================
  // セキュリティ機能：画像検証の強化
  // =============================================================================
  
  /**
   * Base64データが有効な画像かどうかを安全に検証
   * Promise化とリソース管理を実装
   */
  function validateBase64Image(base64String) {
    return new Promise((resolve) => {
      // 同時処理数制限チェック
      if (currentValidationCount >= CONFIG.maxConcurrentValidations) {
        resolve(false);
        return;
      }
      
      currentValidationCount++;
      
      const img = new Image();
      let isResolved = false;
      
      // タイムアウト設定
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          cleanup();
          resolve(false);
        }
      }, CONFIG.imageValidationTimeout);
      
      // リソースクリーンアップ関数
      const cleanup = () => {
        if (isResolved) return;
        isResolved = true;
        
        clearTimeout(timeoutId);
        img.onload = null;
        img.onerror = null;
        img.src = '';
        currentValidationCount--;
      };
      
      img.onload = () => {
        cleanup();
        resolve(true);
      };
      
      img.onerror = () => {
        cleanup();
        resolve(false);
      };
      
      // データ形式に応じてMIMEタイプを設定
      img.src = base64String.startsWith('data:') 
        ? base64String 
        : 'data:image/png;base64,' + base64String;
    });
  }

  // =============================================================================
  // セキュリティ機能：エラーハンドリングの強化
  // =============================================================================
  
  /**
   * セキュアなエラーメッセージ表示
   * 内部情報を露出させない汎用的なメッセージを使用
   */
  function getSecureErrorMessage(errorCode) {
    const errorMessages = {
      'INVALID_DATA': '画像データがありません。',
      'INVALID_BASE64': '画像データの形式が正しくありません。',
      'SIZE_LIMIT_EXCEEDED': 'ファイルサイズが上限を超えています。',
      'INVALID_IMAGE': '画像データとして無効です。',
      'RATE_LIMIT_EXCEEDED': 'リクエスト制限に達しました。しばらく待ってからお試しください。',
      'CONCURRENT_LIMIT_EXCEEDED': '同時処理数の上限に達しています。しばらく待ってからお試しください。',
      'CSP_ERROR': 'セキュリティ設定により画像を表示できません。',
      'UNKNOWN_ERROR': '画像の処理中にエラーが発生しました。'
    };
    
    return errorMessages[errorCode] || errorMessages['UNKNOWN_ERROR'];
  }

  /**
   * エラーログの安全な記録
   * 本番環境では詳細情報をコンソールのみに出力
   */
  function logSecurityEvent(eventType, details) {
    // セキュリティイベントのログ記録
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[Base64Viewer Security] ${eventType}:`, details);
    }
    
    // 将来的にはkintoneの監査ログと連携可能
    // kintone.api() を使ってセキュリティログアプリに記録することも可能
  }

  // =============================================================================
  // DOM操作：安全な画像表示
  // =============================================================================
  
  /**
   * 安全なDOM要素作成とスタイル適用
   */
  function createSecureImageElement(base64String) {
    const img = document.createElement('img');
    img.className = 'antbear-base64-thumb';
    img.style.maxWidth = '300px';
    img.style.cursor = 'pointer';
    img.alt = '画像データ';
    
    // XSS対策：src属性は直接設定
    img.src = base64String.startsWith('data:') 
      ? base64String 
      : 'data:image/png;base64,' + base64String;
    
    return img;
  }

  /**
   * モーダルウィンドウの安全な作成
   */
  function createSecureModal(imageSrc) {
    // モーダル背景
    const modal = document.createElement('div');
    modal.className = 'antbear-base64-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      cursor: pointer;
    `;
    
    // 拡大画像
    const modalImg = document.createElement('img');
    modalImg.style.cssText = `
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
    `;
    modalImg.src = imageSrc;
    modalImg.alt = '拡大画像';
    
    modal.appendChild(modalImg);
    
    // クリックで閉じる
    modal.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    return modal;
  }

  /**
   * エラーメッセージの安全な表示
   */
  function displaySecureErrorMessage(message, spaceElement) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'antbear-base64-error';
    errorDiv.style.cssText = `
      color: #e74c3c;
      padding: 10px;
      border: 1px solid #e74c3c;
      border-radius: 4px;
      background-color: #fdf2f2;
      font-size: 14px;
    `;
    
    // XSS対策：textContentを使用してHTMLエスケープ
    errorDiv.textContent = message;
    
    spaceElement.appendChild(errorDiv);
  }

  // =============================================================================
  // メイン処理：統合されたセキュア画像処理
  // =============================================================================
  
  /**
   * Base64画像の安全な処理と表示
   */
  async function processBase64ImageSecure(base64String, spaceElement) {
    try {
      // 1. レート制限チェック
      checkRateLimit();
      
      // 2. CSP互換性チェック
      if (!checkCSPCompatibility()) {
        throw new Error('CSP_ERROR');
      }
      
      // 3. データ存在チェック
      if (!base64String || base64String.trim() === '') {
        throw new Error('INVALID_DATA');
      }
      
      // 4. サイズ制限チェック
      checkSizeLimit(base64String);
      
      // 5. 同時処理数制限チェック
      checkConcurrentLimit();
      
      // 6. Base64形式の厳格な検証
      if (!isValidBase64(base64String)) {
        throw new Error('INVALID_BASE64');
      }
      
      // 7. 画像として有効か検証
      const isValidImage = await validateBase64Image(base64String);
      if (!isValidImage) {
        throw new Error('INVALID_IMAGE');
      }
      
      // 8. 安全に画像を表示
      const img = createSecureImageElement(base64String);
      
      // モーダル表示のイベントリスナー
      img.addEventListener('click', () => {
        const modal = createSecureModal(img.src);
        document.body.appendChild(modal);
      });
      
      spaceElement.appendChild(img);
      
      // 成功ログ
      logSecurityEvent('IMAGE_DISPLAYED', {
        size: base64String.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // セキュアなエラーハンドリング
      const errorMessage = getSecureErrorMessage(error.message);
      displaySecureErrorMessage(errorMessage, spaceElement);
      
      // セキュリティイベントのログ記録
      logSecurityEvent('SECURITY_ERROR', {
        error: error.message,
        timestamp: new Date().toISOString(),
        dataSize: base64String ? base64String.length : 0
      });
    }
  }

  // =============================================================================
  // kintoneイベントハンドラー
  // =============================================================================
  
  /**
   * レコード詳細画面表示イベント
   */
  kintone.events.on('app.record.detail.show', async (event) => {
    try {
      const record = event.record;
      const spaceElement = kintone.app.record.getSpaceElement(CONFIG.spaceElement);
      
      if (!spaceElement) {
        console.warn(`スペース要素 "${CONFIG.spaceElement}" が見つかりません`);
        return event;
      }
      
      // スペース要素をクリア
      spaceElement.innerHTML = '';
      
      // Base64データを取得
      const base64Field = record[CONFIG.fieldCode];
      const base64String = base64Field ? base64Field.value : '';
      
      // セキュア処理を実行
      await processBase64ImageSecure(base64String, spaceElement);
      
    } catch (error) {
      console.error('Base64Viewer初期化エラー:', error);
    }
    
    return event;
  });

  // =============================================================================
  // 初期化ログ
  // =============================================================================
  
  console.log('kintone_base64_viewer (Security Enhanced v3.0) が読み込まれました');
  console.log('設定:', {
    fieldCode: CONFIG.fieldCode,
    maxSize: `${CONFIG.maxBase64Size}文字 (約${Math.round(CONFIG.maxBase64Size * 0.75 / 1024)}KB)`,
    maxConcurrent: CONFIG.maxConcurrentValidations,
    timeout: `${CONFIG.imageValidationTimeout}ms`
  });

})();