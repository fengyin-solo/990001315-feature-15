/**
 * 社区便民留言板 - 前端脚本
 */
document.addEventListener('DOMContentLoaded', function() {
    // 滚动信息复制实现无缝滚动
    const scrollContent = document.getElementById('scrollContent');
    if (scrollContent) {
        scrollContent.innerHTML += scrollContent.innerHTML;
    }
});

/**
 * 切换收藏状态
 */
function toggleFavorite(event, btn) {
    event.preventDefault();
    event.stopPropagation();

    const messageId = btn.dataset.messageId;
    if (!messageId) return;

    const icon = btn.querySelector('.favorite-icon');
    const text = btn.querySelector('.favorite-text');
    const originalIcon = icon.textContent;
    const originalText = text.textContent;
    const originalClass = btn.className;

    btn.disabled = true;

    const formData = new FormData();
    formData.append('message_id', messageId);
    formData.append('action', 'toggle');

    fetch('api/favorite.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(result => {
        if (result.code === 0) {
            if (result.data.favorited) {
                btn.classList.add('favorited');
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-warning');
                icon.textContent = '⭐';
                text.textContent = '已收藏';
                showToast(result.msg, 'success');
            } else {
                btn.classList.remove('favorited');
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-secondary');
                icon.textContent = '☆';
                text.textContent = '收藏';
                showToast(result.msg, 'info');

                if (window.location.pathname.includes('favorites.php')) {
                    const card = btn.closest('.message-card');
                    if (card) {
                        card.style.transition = 'all 0.3s ease';
                        card.style.opacity = '0';
                        card.style.transform = 'translateX(-100px)';
                        setTimeout(() => {
                            card.remove();
                            updateFavoritesStats();
                            checkEmptyState();
                        }, 300);
                    }
                }
            }
        } else {
            showToast(result.msg || '操作失败', 'error');
            icon.textContent = originalIcon;
            text.textContent = originalText;
            btn.className = originalClass;
        }
    })
    .catch(error => {
        console.error('收藏操作失败:', error);
        showToast('网络错误，请稍后重试', 'error');
        icon.textContent = originalIcon;
        text.textContent = originalText;
        btn.className = originalClass;
    })
    .finally(() => {
        btn.disabled = false;
    });
}

/**
 * 更新收藏页面统计数据
 */
function updateFavoritesStats() {
    const statNumbers = document.querySelectorAll('.favorites-stats .stat-number');
    statNumbers.forEach(el => {
        const current = parseInt(el.textContent) || 0;
        if (current > 0) {
            el.textContent = current - 1;
        }
    });

    const subtitle = document.querySelector('.page-subtitle');
    if (subtitle) {
        const match = subtitle.textContent.match(/\d+/);
        if (match) {
            const current = parseInt(match[0]) || 0;
            subtitle.textContent = `共收藏 ${Math.max(0, current - 1)} 条留言`;
        }
    }
}

/**
 * 检查收藏页面是否为空
 */
function checkEmptyState() {
    const list = document.querySelector('.message-list');
    if (!list) return;

    const cards = list.querySelectorAll('.message-card');
    if (cards.length === 0) {
        const container = document.querySelector('.message-list-section .container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <p>暂无收藏的留言</p>
                    <a href="index.php" class="btn btn-primary">去浏览留言</a>
                </div>
            `;
        }
    }
}

/**
 * 显示提示消息
 */
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;

    const styles = {
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 24px',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '0.9rem',
        zIndex: '9999',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        animation: 'slideDown 0.3s ease',
        maxWidth: '90%',
        textAlign: 'center'
    };

    const typeColors = {
        success: 'background: #10b981',
        error: 'background: #ef4444',
        info: 'background: #3b82f6',
        warning: 'background: #f59e0b'
    };

    Object.assign(toast.style, styles);
    toast.style.cssText += ';' + (typeColors[type] || typeColors.info);

    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes slideDown {
            from { opacity: 0; transform: translate(-50%, -20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(styleSheet);

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2000);
}

/**
 * 打开举报弹窗
 */
function openReportModal(messageId) {
    const modal = document.getElementById('reportModal');
    if (!modal) return;

    document.getElementById('reportMessageId').value = messageId;
    document.getElementById('reportForm').reset();
    document.getElementById('reportDescCount').textContent = '0';
    modal.style.display = 'flex';
}

/**
 * 关闭举报弹窗
 */
function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * 初始化举报表单
 */
function initReportForm() {
    const form = document.getElementById('reportForm');
    if (!form) return;

    const descInput = document.getElementById('reportDescription');
    const descCount = document.getElementById('reportDescCount');

    if (descInput && descCount) {
        descInput.addEventListener('input', function() {
            descCount.textContent = this.value.length;
        });
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        submitReport();
    });

    document.getElementById('reportModal').addEventListener('click', function(e) {
        if (e.target === this) closeReportModal();
    });
}

/**
 * 提交举报
 */
function submitReport() {
    const form = document.getElementById('reportForm');
    if (!form) return;

    const submitBtn = document.getElementById('reportSubmitBtn');
    const messageId = document.getElementById('reportMessageId').value;
    const reportType = form.querySelector('input[name="report_type"]:checked');
    const description = document.getElementById('reportDescription').value;

    if (!reportType) {
        showToast('请选择举报类型', 'warning');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';

    const formData = new FormData();
    formData.append('message_id', messageId);
    formData.append('report_type', reportType.value);
    formData.append('description', description);
    formData.append('action', 'submit');

    fetch('api/report.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(result => {
        if (result.code === 0) {
            showToast(result.msg, 'success');
            closeReportModal();

            const reportBtn = document.querySelector('.report-btn[data-message-id="' + messageId + '"]');
            if (reportBtn) {
                reportBtn.disabled = true;
                reportBtn.classList.remove('btn-danger');
                reportBtn.classList.add('btn-secondary');
                const reportText = reportBtn.querySelector('.report-text');
                if (reportText) {
                    reportText.textContent = '已举报';
                }
            }
        } else {
            showToast(result.msg || '举报失败', 'error');
        }
    })
    .catch(error => {
        console.error('举报提交失败:', error);
        showToast('网络错误，请稍后重试', 'error');
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交举报';
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initReportForm();
    initTrendPanel();
});

/* ========== 运营区间对比 ========== */

const TREND_STORAGE_KEY = 'board_stats_range';

/**
 * 区间对比面板：切换今天/近七天/自定义，
 * 请求失败或区间异常时保留上次结果，并标出未完成区间。
 */
function initTrendPanel() {
    const panel = document.getElementById('trendPanel');
    if (!panel) return;

    const tabs = panel.querySelectorAll('.range-tab');
    const startInput = document.getElementById('customStart');
    const endInput = document.getElementById('customEnd');
    const applyBtn = document.getElementById('customApply');

    // 上次成功获取的结果，异常时继续展示
    let lastData = null;
    let lastRange = null;

    // 读取上次所选区间（再次进入仍保留）
    const saved = loadSavedRange();
    let state = {
        range: saved.range,
        start: saved.start || '',
        end: saved.end || ''
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const range = this.dataset.range;
            state.range = range;
            if (range === 'custom' && (!state.start || !state.end)) {
                // 仅切换到自定义页签，选好日期点“应用”后才重新计算
                renderTabs();
                return;
            }
            loadStats(true);
        });
    });

    applyBtn.addEventListener('click', function() {
        const start = startInput.value;
        const end = endInput.value;
        if (!start || !end) {
            showToast('请选择开始和结束日期', 'warning');
            return;
        }
        if (start > end) {
            showToast('开始日期不能晚于结束日期', 'warning');
            return;
        }
        state.start = start;
        state.end = end;
        loadStats(true);
    });

    renderTabs();
    loadStats(false);

    function renderTabs() {
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.range === state.range);
        });
        panel.querySelector('.custom-range-picker').style.display =
            state.range === 'custom' ? 'inline-flex' : 'none';
        if (state.range === 'custom') {
            startInput.value = state.start || '';
            endInput.value = state.end || '';
        }
    }

    function loadStats(showErrorToast) {
        let url = 'api/stats.php?range=' + encodeURIComponent(state.range);
        if (state.range === 'custom') {
            url += '&start=' + encodeURIComponent(state.start) + '&end=' + encodeURIComponent(state.end);
        }

        fetch(url, {headers: {'Accept': 'application/json'}})
            .then(r => r.json())
            .then(res => {
                if (res.code !== 0 || !res.data) {
                    // 计算异常/区间过大：保留上次结果
                    if (showErrorToast) showToast(res.msg || '统计失败，已保留上次结果', 'warning');
                    keepLastResult(res.msg || '统计暂时不可用');
                    return;
                }
                lastData = res.data;
                lastRange = {range: state.range, start: state.start, end: state.end};
                saveRange(lastRange);
                renderTabs();
                render(res.data);
            })
            .catch(() => {
                // 网络错误：同样保留上次结果
                if (showErrorToast) showToast('网络错误，已保留上次结果', 'warning');
                keepLastResult('网络异常，已保留上次结果');
            });
    }

    function keepLastResult(message) {
        renderTabs();
        if (lastData) {
            render(lastData, true, message);
        } else {
            document.getElementById('trendAlerts').innerHTML =
                '<span class="trend-alert trend-alert-warning">' + escHtml(message) + '</span>';
            document.getElementById('trendFooter').textContent = '';
        }
    }

    function render(data, stale, staleMessage) {
        const labels = {new: '新增留言', approved: '审核通过', rejected: '被拒绝'};

        panel.querySelectorAll('.metric-card').forEach(card => {
            const key = card.dataset.metric;
            const m = data.current.metrics[key];
            const valueEl = card.querySelector('[data-field="value"]');
            const changeEl = card.querySelector('[data-field="change"]');
            const noteEl = card.querySelector('[data-field="note"]');

            valueEl.textContent = m.current;
            card.classList.toggle('metric-anomaly', !!m.change.anomaly);
            changeEl.className = 'metric-change';
            noteEl.textContent = '';

            if (m.previous === null) {
                // 缺少历史数据（上一区间早于建板时间）
                changeEl.innerHTML = '<span class="chip chip-muted">环比 —</span>';
                noteEl.textContent = '上期缺少历史数据';
            } else if (m.change.direction === 'flat') {
                changeEl.innerHTML = '<span class="chip chip-flat">环比持平 · 上期 ' + m.previous + '</span>';
            } else {
                const up = m.change.direction === 'up';
                const sign = up ? '+' : '';
                let text = '环比 ' + sign + m.change.diff + ' 件';
                if (m.change.percent !== null) {
                    text += '（' + sign + m.change.percent + '%）';
                }
                text += ' · 上期 ' + m.previous;
                const cls = m.change.anomaly
                    ? 'chip-anomaly'
                    : (up ? 'chip-up' : 'chip-down');
                const icon = m.change.anomaly ? '⚠️ ' : (up ? '▲ ' : '▼ ');
                changeEl.innerHTML = '<span class="chip ' + cls + '">' + icon + escHtml(text) + '</span>';
                if (m.change.anomaly) {
                    noteEl.textContent = up ? '较上期异常增加，请关注' : '较上期异常下降，请关注';
                }
            }
        });

        // 顶部提示条：异常变化 + 估算 + 未完成/保留标记
        const alerts = [];
        (data.anomalies || []).forEach(text => {
            alerts.push('<span class="trend-alert trend-alert-danger">⚠️ ' + escHtml(text) + '</span>');
        });
        if (data.estimated) {
            alerts.push('<span class="trend-alert trend-alert-info">ℹ️ 审核流水上线前的通过/拒绝数据按记录更新时间估算</span>');
        }
        if (data.incomplete) {
            alerts.push('<span class="trend-alert trend-alert-warn">🕒 当前区间尚未结束，数据为截至目前的实时值</span>');
        }
        if (stale && staleMessage) {
            alerts.push('<span class="trend-alert trend-alert-warning">' + escHtml(staleMessage) + '</span>');
        }
        document.getElementById('trendAlerts').innerHTML = alerts.join('');

        let footer = '本期：' + fmtTime(data.current.start) + ' — ' + fmtTime(data.current.end);
        if (data.previous.available) {
            footer += '　|　上期：' + fmtTime(data.previous.start) + ' — ' + fmtTime(data.previous.end);
        }
        document.getElementById('trendFooter').textContent = footer;
    }

    function loadSavedRange() {
        try {
            const raw = localStorage.getItem(TREND_STORAGE_KEY);
            if (!raw) return {range: 'today'};
            const parsed = JSON.parse(raw);
            if (['today', '7d', 'custom'].indexOf(parsed.range) === -1) return {range: 'today'};
            if (parsed.range === 'custom' && (!parsed.start || !parsed.end)) return {range: 'today'};
            return parsed;
        } catch (e) {
            return {range: 'today'};
        }
    }

    function saveRange(range) {
        try {
            localStorage.setItem(TREND_STORAGE_KEY, JSON.stringify(range));
        } catch (e) { /* 隐私模式等场景下忽略 */ }
    }

    function fmtTime(s) {
        return s ? s.substring(5, 16) : '';
    }

    function escHtml(s) {
        return String(s).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }
}
