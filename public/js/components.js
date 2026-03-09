/* ============================================
   session-forge hub — Reusable UI Components
   ============================================ */

(function () {
  'use strict';

  var esc = window.SFH.escapeHtml;
  var timeAgo = window.SFH.timeAgo;
  var formatDate = window.SFH.formatDate;

  // --- Stats Card ---

  function createStatsCard(label, value, icon) {
    return '' +
      '<div class="stat-card">' +
        '<div class="stat-icon">' + icon + '</div>' +
        '<div class="stat-info">' +
          '<span class="stat-value">' + esc(String(value)) + '</span>' +
          '<span class="stat-label">' + esc(label) + '</span>' +
        '</div>' +
      '</div>';
  }

  // --- Agent Card (grid item) ---

  function createAgentCard(agent) {
    var lastSeenText = agent.last_seen ? timeAgo(agent.last_seen) : 'Never';
    var isOnline = false;
    if (agent.last_seen) {
      var diff = Date.now() - new Date(agent.last_seen).getTime();
      isOnline = diff < 3600000; // Active within last hour
    }

    var statusBadge = isOnline
      ? '<span class="badge badge-online">Online</span>'
      : '<span class="badge badge-inactive">Offline</span>';

    return '' +
      '<a href="agent.html?id=' + esc(agent.id) + '" class="agent-card">' +
        '<div class="agent-card-header">' +
          '<span class="agent-name">' + esc(agent.name) + '</span>' +
          statusBadge +
        '</div>' +
        '<div class="agent-meta">' +
          '<span title="Developer">' + esc(agent.developer || '') + '</span>' +
          '<span title="Machine">' + esc(agent.machine || '') + '</span>' +
        '</div>' +
        '<div class="text-sm text-muted mb-sm">Last seen: ' + esc(lastSeenText) + '</div>' +
        '<div class="agent-stats">' +
          '<span title="Checkpoints">&#9989; ' + (agent.total_checkpoints || 0) + '</span>' +
          '<span title="Decisions">&#9878; ' + (agent.total_decisions || 0) + '</span>' +
          '<span title="Dead Ends">&#9888; ' + (agent.total_dead_ends || 0) + '</span>' +
        '</div>' +
      '</a>';
  }

  // --- Event Card (activity feed item) ---

  function createEventCard(event) {
    var typeLabel = event.type.replace('_', ' ');
    var badgeClass = 'badge badge-' + event.type.replace('_', '-');

    return '' +
      '<div class="event-card">' +
        '<div class="event-badge-col">' +
          '<span class="' + badgeClass + '">' + esc(typeLabel) + '</span>' +
        '</div>' +
        '<div class="event-content">' +
          '<div class="event-header">' +
            '<a href="agent.html?id=' + esc(event.agent_id) + '" class="event-agent">' + esc(event.agent_name) + '</a>' +
            '<span class="event-time" title="' + esc(formatDate(event.timestamp)) + '">' + esc(timeAgo(event.timestamp)) + '</span>' +
          '</div>' +
          '<div class="event-summary">' + esc(event.summary) + '</div>' +
        '</div>' +
      '</div>';
  }

  // --- Decision Card ---

  function createDecisionCard(decision, agentName) {
    var tagsHtml = '';
    if (decision.tags && decision.tags.length > 0) {
      tagsHtml = '<div class="tags-list">';
      decision.tags.forEach(function (tag) {
        tagsHtml += '<span class="tag">' + esc(tag) + '</span>';
      });
      tagsHtml += '</div>';
    }

    var projectHtml = '';
    if (decision.project) {
      projectHtml = '<span class="tag">' + esc(decision.project) + '</span>';
    }

    var agentHtml = '';
    if (agentName) {
      agentHtml = '<span class="text-sm" style="color:var(--accent-light);">' + esc(agentName) + '</span>';
    }

    var alternativesHtml = '';
    if (decision.alternatives && decision.alternatives.length > 0) {
      alternativesHtml = '<div class="text-sm text-muted mt-md"><strong>Alternatives considered:</strong> ' +
        decision.alternatives.map(function (a) { return esc(a); }).join(', ') + '</div>';
    }

    var outcomeHtml = '';
    if (decision.outcome) {
      outcomeHtml = '<div class="text-sm mt-md" style="color:var(--color-green);"><strong>Outcome:</strong> ' + esc(decision.outcome) + '</div>';
    }

    return '' +
      '<div class="decision-card">' +
        '<div class="decision-choice">' + esc(decision.choice) + '</div>' +
        '<div class="decision-reasoning">' + esc(decision.reasoning) + '</div>' +
        alternativesHtml +
        outcomeHtml +
        '<div class="decision-meta">' +
          agentHtml +
          projectHtml +
          tagsHtml +
          '<span class="text-sm text-muted" style="margin-left:auto;" title="' + esc(formatDate(decision.timestamp)) + '">' + esc(timeAgo(decision.timestamp)) + '</span>' +
        '</div>' +
      '</div>';
  }

  // --- Dead End Card ---

  function createDeadEndCard(deadEnd, agentName) {
    var tagsHtml = '';
    if (deadEnd.tags && deadEnd.tags.length > 0) {
      tagsHtml = '<div class="tags-list mt-md">';
      deadEnd.tags.forEach(function (tag) {
        tagsHtml += '<span class="tag">' + esc(tag) + '</span>';
      });
      tagsHtml += '</div>';
    }

    var lessonHtml = '';
    if (deadEnd.lesson) {
      lessonHtml = '<div class="dead-end-lesson">Lesson: ' + esc(deadEnd.lesson) + '</div>';
    }

    var filesHtml = '';
    if (deadEnd.files_involved && deadEnd.files_involved.length > 0) {
      filesHtml = '<div class="text-sm text-muted mt-md"><strong>Files:</strong> ' +
        deadEnd.files_involved.map(function (f) { return '<code>' + esc(f) + '</code>'; }).join(', ') + '</div>';
    }

    var agentHtml = '';
    if (agentName) {
      agentHtml = '<span class="text-sm" style="color:var(--accent-light);margin-right:auto;">' + esc(agentName) + '</span>';
    }

    return '' +
      '<div class="dead-end-card">' +
        '<div class="dead-end-attempted">' + esc(deadEnd.attempted) + '</div>' +
        '<div class="dead-end-failed">' + esc(deadEnd.why_failed) + '</div>' +
        lessonHtml +
        filesHtml +
        tagsHtml +
        '<div class="flex items-center justify-between mt-md">' +
          agentHtml +
          '<span class="text-sm text-muted" title="' + esc(formatDate(deadEnd.timestamp)) + '">' + esc(timeAgo(deadEnd.timestamp)) + '</span>' +
        '</div>' +
      '</div>';
  }

  // --- Journal Card ---

  function createJournalCard(journal, agentName) {
    var momentsHtml = '';
    if (journal.key_moments && journal.key_moments.length > 0) {
      momentsHtml = '<div class="mt-md"><strong class="text-sm">Key Moments:</strong><ul style="list-style:disc;padding-left:1.5rem;margin-top:0.25rem;">';
      journal.key_moments.forEach(function (m) {
        momentsHtml += '<li class="text-sm text-secondary">' + esc(m) + '</li>';
      });
      momentsHtml += '</ul></div>';
    }

    var breakthroughsHtml = '';
    if (journal.breakthroughs && journal.breakthroughs.length > 0) {
      breakthroughsHtml = '<div class="mt-md"><strong class="text-sm" style="color:var(--color-green);">Breakthroughs:</strong><ul style="list-style:disc;padding-left:1.5rem;margin-top:0.25rem;">';
      journal.breakthroughs.forEach(function (b) {
        breakthroughsHtml += '<li class="text-sm" style="color:var(--color-green);">' + esc(b) + '</li>';
      });
      breakthroughsHtml += '</ul></div>';
    }

    var frustHtml = '';
    if (journal.frustrations && journal.frustrations.length > 0) {
      frustHtml = '<div class="mt-md"><strong class="text-sm" style="color:var(--color-red);">Frustrations:</strong><ul style="list-style:disc;padding-left:1.5rem;margin-top:0.25rem;">';
      journal.frustrations.forEach(function (f) {
        frustHtml += '<li class="text-sm" style="color:var(--color-red);">' + esc(f) + '</li>';
      });
      frustHtml += '</ul></div>';
    }

    var emotionalHtml = '';
    if (journal.emotional_context) {
      emotionalHtml = '<div class="text-sm text-secondary mt-md"><em>' + esc(journal.emotional_context) + '</em></div>';
    }

    var collabHtml = '';
    if (journal.collaboration_notes) {
      collabHtml = '<div class="text-sm text-secondary mt-md"><strong>Collaboration:</strong> ' + esc(journal.collaboration_notes) + '</div>';
    }

    return '' +
      '<div class="card mb-md">' +
        '<div class="card-header">' +
          '<h3><span class="badge badge-journal">Journal</span>' +
            (agentName ? ' <span class="text-sm" style="color:var(--accent-light);font-weight:400;">' + esc(agentName) + '</span>' : '') +
          '</h3>' +
          '<span class="text-sm text-muted" title="' + esc(formatDate(journal.timestamp)) + '">' + esc(timeAgo(journal.timestamp)) + '</span>' +
        '</div>' +
        '<div class="card-body">' +
          '<p class="text-secondary">' + esc(journal.session_summary) + '</p>' +
          momentsHtml +
          breakthroughsHtml +
          frustHtml +
          emotionalHtml +
          collabHtml +
        '</div>' +
      '</div>';
  }

  // --- Checkpoint Card ---

  function createCheckpointCard(checkpoint, agentName) {
    var statusColors = {
      'IN_PROGRESS': 'var(--color-blue)',
      'BLOCKED': 'var(--color-red)',
      'WAITING_USER': 'var(--color-yellow)',
      'COMPLETED': 'var(--color-green)',
    };
    var statusColor = statusColors[checkpoint.status] || 'var(--text-muted)';

    var filesHtml = '';
    if (checkpoint.files_touched && checkpoint.files_touched.length > 0) {
      filesHtml = '<div class="text-sm text-muted mt-md"><strong>Files:</strong> ' +
        checkpoint.files_touched.slice(0, 5).map(function (f) { return '<code>' + esc(f) + '</code>'; }).join(', ') +
        (checkpoint.files_touched.length > 5 ? ' <em>+' + (checkpoint.files_touched.length - 5) + ' more</em>' : '') +
        '</div>';
    }

    var nextStepsHtml = '';
    if (checkpoint.next_steps && checkpoint.next_steps.length > 0) {
      nextStepsHtml = '<div class="text-sm text-muted mt-md"><strong>Next:</strong> ' +
        checkpoint.next_steps.map(function (s) { return esc(s); }).join(' &rarr; ') + '</div>';
    }

    return '' +
      '<div class="card mb-md" style="border-left:3px solid ' + statusColor + ';">' +
        '<div class="card-header">' +
          '<h3>' +
            '<span class="badge badge-checkpoint">Checkpoint</span> ' +
            esc(checkpoint.task) +
          '</h3>' +
          '<span class="text-sm text-muted" title="' + esc(formatDate(checkpoint.timestamp)) + '">' + esc(timeAgo(checkpoint.timestamp)) + '</span>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="flex items-center gap-sm mb-sm">' +
            '<span class="badge" style="background:' + statusColor + '22;color:' + statusColor + ';">' + esc(checkpoint.status) + '</span>' +
            (agentName ? '<span class="text-sm" style="color:var(--accent-light);">' + esc(agentName) + '</span>' : '') +
          '</div>' +
          '<p class="text-secondary text-sm">' + esc(checkpoint.intent) + '</p>' +
          filesHtml +
          nextStepsHtml +
        '</div>' +
      '</div>';
  }

  // --- Modal Builder ---

  function createModal(title, contentHtml, footerHtml) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h2>' + esc(title) + '</h2>' +
          '<button class="modal-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' + contentHtml + '</div>' +
        (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') +
      '</div>';

    // Close handlers
    var closeBtn = overlay.querySelector('.modal-close');
    closeBtn.addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  // --- Empty State ---

  function createEmptyState(icon, title, message) {
    return '' +
      '<div class="empty-state">' +
        '<div class="empty-icon">' + (icon || '') + '</div>' +
        '<h3>' + esc(title || 'Nothing here yet') + '</h3>' +
        '<p>' + esc(message || '') + '</p>' +
      '</div>';
  }

  // --- Loading State ---

  function createLoading() {
    return '<div class="loading"><div class="spinner"></div></div>';
  }

  // --- Report Highlight ---

  function createReportHighlight(agentLabel, text) {
    return '' +
      '<div class="report-highlight">' +
        '<div class="agent-label">' + esc(agentLabel) + '</div>' +
        '<div class="text">' + esc(text) + '</div>' +
      '</div>';
  }

  // --- Search Result Card ---

  function createSearchResultCard(result, type) {
    if (type === 'decisions') {
      return '' +
        '<div class="decision-card">' +
          '<div class="flex items-center justify-between mb-sm">' +
            '<span class="text-sm" style="color:var(--accent-light);">' + esc(result.agent_name) + '</span>' +
            '<span class="badge badge-decision">Score: ' + result.score + '</span>' +
          '</div>' +
          '<div class="decision-choice">' + esc(result.choice) + '</div>' +
          '<div class="decision-reasoning">' + esc(result.reasoning) + '</div>' +
          (result.project ? '<span class="tag mt-md">' + esc(result.project) + '</span>' : '') +
          (result.tags && result.tags.length ? '<div class="tags-list mt-md">' + result.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="text-sm text-muted mt-md">' + esc(timeAgo(result.timestamp)) + '</div>' +
        '</div>';
    } else {
      return '' +
        '<div class="dead-end-card">' +
          '<div class="flex items-center justify-between mb-sm">' +
            '<span class="text-sm" style="color:var(--accent-light);">' + esc(result.agent_name) + '</span>' +
            '<span class="badge badge-dead-end">Score: ' + result.score + '</span>' +
          '</div>' +
          '<div class="dead-end-attempted">' + esc(result.attempted) + '</div>' +
          '<div class="dead-end-failed">' + esc(result.why_failed) + '</div>' +
          (result.lesson ? '<div class="dead-end-lesson">Lesson: ' + esc(result.lesson) + '</div>' : '') +
          (result.project ? '<span class="tag mt-md">' + esc(result.project) + '</span>' : '') +
          (result.tags && result.tags.length ? '<div class="tags-list mt-md">' + result.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="text-sm text-muted mt-md">' + esc(timeAgo(result.timestamp)) + '</div>' +
        '</div>';
    }
  }

  // --- Expose ---

  window.SFH.components = {
    createStatsCard: createStatsCard,
    createAgentCard: createAgentCard,
    createEventCard: createEventCard,
    createDecisionCard: createDecisionCard,
    createDeadEndCard: createDeadEndCard,
    createJournalCard: createJournalCard,
    createCheckpointCard: createCheckpointCard,
    createModal: createModal,
    createEmptyState: createEmptyState,
    createLoading: createLoading,
    createReportHighlight: createReportHighlight,
    createSearchResultCard: createSearchResultCard,
  };

})();
