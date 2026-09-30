/**
 * Header Component Script
 * Handles mobile search input dynamics and clear button interactions
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBarFrame = document.getElementById('searchBarFrame');
    const clearBtn = document.getElementById('clearBtn');

    if (!searchInput || !searchBarFrame) return;

    // Show/hide clear button based on text
    if (clearBtn) {
      searchInput.addEventListener('input', () => {
        clearBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
      });

      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchInput.value = '';
        clearBtn.style.display = 'none';
        searchInput.focus();
      });
    }

    // Dismiss keyboard on Enter
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchInput.blur();
      }
    });

    // Mobile touch press feedback
    searchBarFrame.addEventListener('touchstart', () => {
      searchBarFrame.classList.add('pressed');
    }, { passive: true });

    searchBarFrame.addEventListener('touchend', () => {
      searchBarFrame.classList.remove('pressed');
    }, { passive: true });

    searchBarFrame.addEventListener('touchcancel', () => {
      searchBarFrame.classList.remove('pressed');
    }, { passive: true });
  });
})();
