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
    initCompareModule();
});

/**
 * 区间对比模块
 * 支持今天、近七天、自定义区间切换
 * 状态保持：localStorage 保存所选区间
 * 容错：请求失败时保留上次结果并标出未完成区间
 */
const CompareModule = {
    // 配置
    storageKeys: {
        range: 'compare_range',
        customStart: 'compare_custom_start',
        customEnd: 'compare_custom_end',
        lastResult: 'compare_last_result'
    },

    // 状态
    currentRange: 'today',
    customStart: '',
    customEnd: '',
    lastResult: null,
    isStale: false,

    /**
     * 初始化
     */
    init() {
        const container = document.getElementById('compareBody');
        if (!container) return;

        // 从 localStorage 恢复状态
        this.restoreState();

        // 绑定事件
        this.bindEvents();

        // 设置自定义区间输入框的值
        this.setCustomInputs();

        // 加载数据
        this.loadData();
    },

    /**
     * 从 localStorage 恢复状态
     */
    restoreState() {
        this.currentRange = localStorage.getItem(this.storageKeys.range) || 'today';
        this.customStart = localStorage.getItem(this.storageKeys.customStart) || '';
        this.customEnd = localStorage.getItem(this.storageKeys.customEnd) || '';

        const lastResultStr = localStorage.getItem(this.storageKeys.lastResult);
        if (lastResultStr) {
            try {
                this.lastResult = JSON.parse(lastResultStr);
            } catch (e) {
                this.lastResult = null;
            }
        }

        // 更新标签页状态
        this.updateTabs();

        // 显示/隐藏自定义区间
        this.toggleCustomRange();
    },

    /**
     * 保存状态到 localStorage
     */
    saveState() {
        localStorage.setItem(this.storageKeys.range, this.currentRange);
        if (this.currentRange === 'custom') {
            localStorage.setItem(this.storageKeys.customStart, this.customStart);
            localStorage.setItem(this.storageKeys.customEnd, this.customEnd);
        }
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 标签页切换
        document.querySelectorAll('.range-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentRange = tab.dataset.range;
                this.updateTabs();
                this.toggleCustomRange();
                this.saveState();

                // 非自定义区间直接加载
                if (this.currentRange !== 'custom') {
                    this.loadData();
                } else if (this.customStart && this.customEnd) {
                    // 自定义区间且有日期时自动加载
                    this.loadData();
                }
            });
        });

        // 日期输入变化
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');
        if (startInput) {
            startInput.addEventListener('change', () => {
                this.customStart = startInput.value;
            });
        }
        if (endInput) {
            endInput.addEventListener('change', () => {
                this.customEnd = endInput.value;
            });
        }

        // 查询按钮
        const queryBtn = document.getElementById('queryBtn');
        if (queryBtn) {
            queryBtn.addEventListener('click', () => {
                this.customStart = startInput ? startInput.value : '';
                this.customEnd = endInput ? endInput.value : '';
                if (!this.customStart || !this.customEnd) {
                    this.showNotice('请选择开始和结束日期', 'error');
                    return;
                }
                this.saveState();
                this.loadData();
            });
        }
    },

    /**
     * 更新标签页状态
     */
    updateTabs() {
        document.querySelectorAll('.range-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.range === this.currentRange);
        });
    },

    /**
     * 切换自定义区间显示
     */
    toggleCustomRange() {
        const customRange = document.getElementById('customRange');
        if (customRange) {
            customRange.style.display = this.currentRange === 'custom' ? 'flex' : 'none';
        }
    },

    /**
     * 设置自定义区间输入框的值
     */
    setCustomInputs() {
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');

        // 设置默认值为最近7天
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 6);

        if (startInput) {
            startInput.value = this.customStart || this.formatDate(weekAgo);
            startInput.max = this.formatDate(today);
        }
        if (endInput) {
            endInput.value = this.customEnd || this.formatDate(today);
            endInput.max = this.formatDate(today);
        }
    },

    /**
     * 格式化日期为 YYYY-MM-DD
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * 加载数据
     */
    loadData() {
        const container = document.getElementById('compareBody');
        if (!container) return;

        // 显示加载状态
        container.innerHTML = '<div class="compare-loading">加载中...</div>';
        this.hideNotice();

        // 构建请求 URL
        let url = 'api/stats.php?range=' + this.currentRange;
        if (this.currentRange === 'custom') {
            url += '&start=' + encodeURIComponent(this.customStart);
            url += '&end=' + encodeURIComponent(this.customEnd);
        }

        fetch(url)
            .then(response => response.json())
            .then(result => {
                if (result.code === 0) {
                    // 成功：渲染数据并保存
                    this.lastResult = result.data;
                    this.isStale = false;
                    localStorage.setItem(this.storageKeys.lastResult, JSON.stringify(result.data));
                    this.render(result.data);

                    // 显示警告信息
                    if (result.data.warnings && result.data.warnings.length > 0) {
                        this.showNotice(result.data.warnings.join('；'), 'warning');
                    }
                } else {
                    // 失败：保留上次结果并标出未完成
                    this.handleError(result.msg, result.data);
                }
            })
            .catch(error => {
                console.error('加载对比数据失败:', error);
                this.handleError('网络错误，请稍后重试', null);
            });
    },

    /**
     * 处理错误：保留上次结果并标出未完成区间
     */
    handleError(msg, errorData) {
        if (this.lastResult) {
            // 有上次结果：显示上次结果并标记为过期
            this.isStale = true;
            this.render(this.lastResult, true);
            this.showNotice(msg + '，显示上次结果', 'error');
        } else {
            // 无上次结果：显示错误
            const container = document.getElementById('compareBody');
            if (container) {
                container.innerHTML = '<div class="compare-loading">数据加载失败：' + msg + '</div>';
            }
            this.showNotice(msg, 'error');
        }
    },

    /**
     * 渲染对比数据
     */
    render(data, isStale = false) {
        const container = document.getElementById('compareBody');
        if (!container) return;

        const metrics = [
            { key: 'new', label: '新增', icon: '📝' },
            { key: 'approved', label: '通过', icon: '✅' },
            { key: 'rejected', label: '被拒绝', icon: '❌' }
        ];

        let html = '<div class="compare-grid' + (isStale ? ' compare-stale' : '') + '">';

        metrics.forEach(metric => {
            const current = data.current[metric.key];
            const previous = data.previous[metric.key];
            const change = data.changes[metric.key];

            let changeHtml = '';
            let changeClass = 'change-flat';
            let changeIcon = '→';

            if (change.no_history) {
                changeHtml = '<span class="change-flat">无对比数据</span>';
            } else if (change.percent !== null) {
                if (change.percent > 0) {
                    changeClass = 'change-up';
                    changeIcon = '↑';
                } else if (change.percent < 0) {
                    changeClass = 'change-down';
                    changeIcon = '↓';
                }
                changeHtml = '<span class="' + changeClass + '">' + changeIcon + ' ' + Math.abs(change.percent) + '%</span>';
            }

            // 异常标记
            let abnormalBadge = '';
            if (change.abnormal) {
                abnormalBadge = '<span class="change-abnormal">异常</span>';
            }

            html += `
                <div class="compare-item${change.abnormal ? ' abnormal' : ''}">
                    <div class="compare-item-label">${metric.icon} ${metric.label}${abnormalBadge}</div>
                    <div class="compare-item-value">${current}</div>
                    <div class="compare-item-change">${changeHtml}</div>
                    <div class="compare-item-previous">上期: ${previous}</div>
                </div>
            `;
        });

        html += '</div>';

        // 区间信息
        const rangeInfo = this.formatRangeInfo(data, isStale);
        html += '<div class="compare-range-info">' + rangeInfo + '</div>';

        container.innerHTML = html;
    },

    /**
     * 格式化区间信息
     */
    formatRangeInfo(data, isStale) {
        let info = `当前区间: ${data.current.start} ~ ${data.current.end}`;
        info += ` | 对比区间: ${data.previous.start} ~ ${data.previous.end}`;

        if (isStale) {
            info += ' <span class="incomplete-badge">数据未更新</span>';
        }

        if (data.incomplete && data.incomplete.length > 0) {
            const labels = { current: '当前区间', previous: '对比区间' };
            const incompleteLabels = data.incomplete.map(k => labels[k] || k).join('、');
            info += ` <span class="incomplete-badge">${incompleteLabels}未完成</span>`;
        }

        return info;
    },

    /**
     * 显示提示信息
     */
    showNotice(msg, type = 'warning') {
        const notice = document.getElementById('compareNotice');
        if (notice) {
            notice.textContent = msg;
            notice.className = 'compare-notice' + (type === 'error' ? ' error' : '');
            notice.style.display = 'block';
        }
    },

    /**
     * 隐藏提示信息
     */
    hideNotice() {
        const notice = document.getElementById('compareNotice');
        if (notice) {
            notice.style.display = 'none';
        }
    }
};

/**
 * 初始化区间对比模块
 */
function initCompareModule() {
    CompareModule.init();
}
