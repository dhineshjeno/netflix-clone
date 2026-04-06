/* ===========================
   NETFLIX CLONE - APP.JS
   Full-featured Netflix UI with TMDB API
   =========================== */

// ===== CONFIG =====
const TMDB_API_KEY = '2dca580c2a14b55200e784d157207b4d';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/';
const IMG_SIZES = {
    backdrop: 'original',
    poster: 'w500',
    card: 'w780',
    thumb: 'w300'
};

// Genre map for quick lookup
const GENRE_MAP = {};

// My List (persisted in localStorage)
let myList = JSON.parse(localStorage.getItem('netflix_mylist') || '[]');

// State
let heroMovie = null;
let currentSection = 'home';

// ===== API HELPERS =====
async function tmdbFetch(endpoint, params = {}) {
    const url = new URL(`${TMDB_BASE}${endpoint}`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    url.searchParams.set('language', 'en-US');
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TMDB Error: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('API Error:', err);
        return null;
    }
}

async function fetchGenres() {
    const [movieGenres, tvGenres] = await Promise.all([
        tmdbFetch('/genre/movie/list'),
        tmdbFetch('/genre/tv/list')
    ]);
    if (movieGenres?.genres) movieGenres.genres.forEach(g => GENRE_MAP[g.id] = g.name);
    if (tvGenres?.genres) tvGenres.genres.forEach(g => GENRE_MAP[g.id] = g.name);
}

function getGenreNames(ids = []) {
    return ids.slice(0, 3).map(id => GENRE_MAP[id] || 'Unknown');
}

function imgUrl(path, size = 'card') {
    if (!path) return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="170" fill="%23222"%3E%3Crect width="300" height="170"/%3E%3Ctext x="150" y="90" fill="%23555" text-anchor="middle" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E';
    return `${IMG_BASE}${IMG_SIZES[size] || size}${path}`;
}

// ===== CATEGORY DEFINITIONS =====
const HOME_ROWS = [
    { title: 'Trending Now', endpoint: '/trending/all/week' },
    { title: 'Popular Movies', endpoint: '/movie/popular' },
    { title: 'Top Rated', endpoint: '/movie/top_rated', isTop10: true },
    { title: 'Action & Adventure', endpoint: '/discover/movie', params: { with_genres: '28' } },
    { title: 'Comedy', endpoint: '/discover/movie', params: { with_genres: '35' } },
    { title: 'Horror', endpoint: '/discover/movie', params: { with_genres: '27' } },
    { title: 'Sci-Fi & Fantasy', endpoint: '/discover/movie', params: { with_genres: '878' } },
    { title: 'Documentaries', endpoint: '/discover/movie', params: { with_genres: '99' } },
    { title: 'Romance', endpoint: '/discover/movie', params: { with_genres: '10749' } },
];

const TV_ROWS = [
    { title: 'Trending TV Shows', endpoint: '/trending/tv/week' },
    { title: 'Popular TV Shows', endpoint: '/tv/popular' },
    { title: 'Top Rated TV Shows', endpoint: '/tv/top_rated', isTop10: true },
    { title: 'Crime TV', endpoint: '/discover/tv', params: { with_genres: '80' } },
    { title: 'Drama', endpoint: '/discover/tv', params: { with_genres: '18' } },
    { title: 'Sci-Fi & Fantasy TV', endpoint: '/discover/tv', params: { with_genres: '10765' } },
    { title: 'Animation', endpoint: '/discover/tv', params: { with_genres: '16' } },
];

const MOVIE_ROWS = [
    { title: 'Now Playing', endpoint: '/movie/now_playing' },
    { title: 'Upcoming', endpoint: '/movie/upcoming' },
    { title: 'Popular Movies', endpoint: '/movie/popular', isTop10: true },
    { title: 'Thriller', endpoint: '/discover/movie', params: { with_genres: '53' } },
    { title: 'Mystery', endpoint: '/discover/movie', params: { with_genres: '9648' } },
    { title: 'War', endpoint: '/discover/movie', params: { with_genres: '10752' } },
    { title: 'Family', endpoint: '/discover/movie', params: { with_genres: '10751' } },
    { title: 'Music', endpoint: '/discover/movie', params: { with_genres: '10402' } },
];

// ===== SPLASH SCREEN =====
function hideSplash() {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.classList.add('hidden');
        setTimeout(() => splash.remove(), 800);
    }, 2200);
}

// ===== NAVBAR =====
function initNavbar() {
    const navbar = document.getElementById('navbar');

    // Scroll effect
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    // Search toggle
    const searchContainer = document.getElementById('search-container');
    const searchToggle = document.getElementById('search-toggle');
    const searchInput = document.getElementById('search-input');

    searchToggle.addEventListener('click', () => {
        searchContainer.classList.toggle('active');
        if (searchContainer.classList.contains('active')) {
            searchInput.focus();
        } else {
            searchInput.value = '';
            hideSearchResults();
        }
    });

    // Search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 2) {
            hideSearchResults();
            return;
        }
        searchTimeout = setTimeout(() => performSearch(query), 400);
    });

    // Close search on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchContainer.classList.remove('active');
            searchInput.value = '';
            hideSearchResults();
            closeModal();
            closeVideoPlayer();
        }
    });

    // Nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            switchSection(section);
        });
    });
}

// ===== SECTION SWITCHING =====
async function switchSection(section) {
    currentSection = section;
    const container = document.getElementById('rows-container');
    container.innerHTML = '';

    if (section === 'mylist') {
        renderMyList();
        return;
    }

    let rows;
    switch (section) {
        case 'tvshows': rows = TV_ROWS; break;
        case 'movies': rows = MOVIE_ROWS; break;
        default: rows = HOME_ROWS;
    }

    // Show skeleton loading with data-index
    rows.forEach((row, idx) => {
        container.innerHTML += createSkeletonRow(row.title, idx);
    });

    // Fetch all rows in parallel for speed
    const fetchPromises = rows.map(rowDef =>
        tmdbFetch(rowDef.endpoint, { ...rowDef.params, page: 1 })
    );
    const results = await Promise.all(fetchPromises);

    // Replace skeletons with real rows
    results.forEach((data, i) => {
        if (data?.results?.length) {
            const skeleton = container.querySelector(`.skeleton-row[data-index="${i}"]`);
            if (skeleton) {
                const realRow = createMovieRow(rows[i].title, data.results, rows[i].isTop10);
                skeleton.replaceWith(realRow);
                requestAnimationFrame(() => observeRow(realRow));
            }
        }
    });
}

function renderMyList() {
    const container = document.getElementById('rows-container');
    container.innerHTML = '';

    if (myList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
                <h3>Your list is empty</h3>
                <p>Add movies and TV shows to your list to watch them later</p>
            </div>
        `;
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'movie-row visible';
    grid.style.padding = '40px 4%';

    const title = document.createElement('h2');
    title.className = 'row-title';
    title.textContent = 'My List';
    title.style.marginBottom = '20px';
    grid.appendChild(title);

    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;';

    myList.forEach(item => {
        const card = document.createElement('div');
        card.className = 'search-result-card';
        card.innerHTML = `
            <img src="${imgUrl(item.backdrop_path || item.poster_path, 'card')}" 
                 alt="${item.title || item.name}" loading="lazy">
            <div class="card-title">${item.title || item.name}</div>
        `;
        card.addEventListener('click', () => openModal(item));
        gridContainer.appendChild(card);
    });

    grid.appendChild(gridContainer);
    container.appendChild(grid);
}

// ===== HERO BANNER =====
async function loadHeroBanner() {
    const data = await tmdbFetch('/trending/movie/week');
    if (!data?.results?.length) return;

    // Pick a random movie with a backdrop
    const candidates = data.results.filter(m => m.backdrop_path);
    heroMovie = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];

    renderHero(heroMovie);
}

function renderHero(movie) {
    const heroBg = document.getElementById('hero-bg');
    const heroTitle = document.getElementById('hero-title');
    const heroOverview = document.getElementById('hero-overview');
    const heroRating = document.getElementById('hero-rating-text');
    const heroYear = document.getElementById('hero-year');

    heroBg.style.backgroundImage = `url(${imgUrl(movie.backdrop_path, 'backdrop')})`;
    heroTitle.textContent = movie.title || movie.name;
    heroOverview.textContent = movie.overview;
    heroRating.textContent = movie.vote_average?.toFixed(1);
    heroYear.textContent = (movie.release_date || movie.first_air_date || '').split('-')[0];

    // Play button
    document.getElementById('btn-play').onclick = () => playMovie(movie);
    document.getElementById('btn-info').onclick = () => openModal(movie);
}

// ===== MOVIE ROWS =====
function createSkeletonRow(title, index = 0) {
    return `
        <div class="movie-row skeleton-row visible" data-index="${index}">
            <div class="row-header">
                <h2 class="row-title">${title}</h2>
            </div>
            <div class="slider-wrapper">
                <div class="slider">
                    ${Array(6).fill('<div class="skeleton skeleton-card"></div>').join('')}
                </div>
            </div>
        </div>
    `;
}

function createMovieRow(title, movies, isTop10 = false) {
    const row = document.createElement('div');
    row.className = 'movie-row';

    const header = document.createElement('div');
    header.className = 'row-header';
    header.innerHTML = `
        <h2 class="row-title">
            ${title}
            <span class="explore-link">Explore All <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></span>
        </h2>
    `;

    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'slider-wrapper';

    const slider = document.createElement('div');
    slider.className = `slider${isTop10 ? ' top10-slider' : ''}`;

    movies.forEach((movie, index) => {
        if (isTop10 && index >= 10) return;
        const card = isTop10 ? createTop10Card(movie, index + 1) : createMovieCard(movie);
        slider.appendChild(card);
    });

    // Slider navigation buttons
    const leftBtn = document.createElement('button');
    leftBtn.className = 'slider-btn left';
    leftBtn.innerHTML = '‹';
    leftBtn.setAttribute('aria-label', 'Scroll left');
    leftBtn.addEventListener('click', () => {
        slider.scrollBy({ left: -slider.clientWidth * 0.8, behavior: 'smooth' });
    });

    const rightBtn = document.createElement('button');
    rightBtn.className = 'slider-btn right';
    rightBtn.innerHTML = '›';
    rightBtn.setAttribute('aria-label', 'Scroll right');
    rightBtn.addEventListener('click', () => {
        slider.scrollBy({ left: slider.clientWidth * 0.8, behavior: 'smooth' });
    });

    sliderWrapper.appendChild(leftBtn);
    sliderWrapper.appendChild(slider);
    sliderWrapper.appendChild(rightBtn);

    row.appendChild(header);
    row.appendChild(sliderWrapper);

    return row;
}

function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';

    const isInList = myList.some(m => m.id === movie.id);
    const genreNames = getGenreNames(movie.genre_ids);
    const rating = Math.round((movie.vote_average || 0) * 10);
    const year = (movie.release_date || movie.first_air_date || '').split('-')[0];

    card.innerHTML = `
        <div class="card-img-container">
            <img class="card-img loading" 
                 data-src="${imgUrl(movie.backdrop_path || movie.poster_path, 'card')}" 
                 alt="${movie.title || movie.name}" loading="lazy">
        </div>
        <div class="card-info">
            <div class="card-actions">
                <button class="card-action-btn play-btn" aria-label="Play" title="Play">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#000"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
                <button class="card-action-btn add-list-btn ${isInList ? 'added' : ''}" aria-label="Add to list" title="${isInList ? 'Remove from list' : 'Add to list'}">
                    ${isInList
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'}
                </button>
                <button class="card-action-btn like-btn" aria-label="Like" title="Like">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                </button>
                <button class="card-action-btn expand-btn" aria-label="More info" title="More info">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            </div>
            <div class="card-meta">
                <span class="card-match">${rating}% Match</span>
                <span class="card-badge">${year}</span>
                <span class="card-badge">HD</span>
            </div>
            <div class="card-genres">
                ${genreNames.map(g => `<span>${g}</span>`).join('')}
            </div>
        </div>
    `;

    // Lazy load image
    const img = card.querySelector('.card-img');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                img.src = img.dataset.src;
                img.onload = () => img.classList.remove('loading');
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '200px' });
    observer.observe(card);

    // Event listeners
    card.querySelector('.play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        playMovie(movie);
    });

    card.querySelector('.add-list-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMyList(movie);
        // Update button visually
        const btn = e.currentTarget;
        const isNowInList = myList.some(m => m.id === movie.id);
        btn.classList.toggle('added', isNowInList);
        btn.innerHTML = isNowInList
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    });

    card.querySelector('.expand-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(movie);
    });

    card.addEventListener('click', () => openModal(movie));

    return card;
}

function createTop10Card(movie, rank) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
        <span class="top10-number">${rank}</span>
        <div class="card-img-container">
            <img class="card-img loading" 
                 data-src="${imgUrl(movie.poster_path, 'poster')}" 
                 alt="${movie.title || movie.name}" loading="lazy">
        </div>
        <div class="card-info"></div>
    `;

    // Lazy load
    const img = card.querySelector('.card-img');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                img.src = img.dataset.src;
                img.onload = () => img.classList.remove('loading');
                observer.unobserve(entry.target);
            }
        });
    }, { rootMargin: '200px' });
    observer.observe(card);

    card.addEventListener('click', () => openModal(movie));
    return card;
}

// ===== SCROLL OBSERVE FOR ROW ANIMATIONS =====
function observeRow(row) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '100px' });
    observer.observe(row);
}

// ===== DETAIL MODAL =====
async function openModal(movie) {
    const modal = document.getElementById('movie-modal');
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');

    // Fetch full details
    const details = await tmdbFetch(`/${mediaType}/${movie.id}`, { append_to_response: 'videos,similar,credits' });

    // Populate modal
    const heroImg = document.getElementById('modal-hero');
    heroImg.style.backgroundImage = `url(${imgUrl(movie.backdrop_path || movie.poster_path, 'backdrop')})`;
    heroImg.style.backgroundSize = 'cover';
    heroImg.style.backgroundPosition = 'center';

    document.getElementById('modal-title').textContent = movie.title || movie.name;
    document.getElementById('modal-match').textContent = `${Math.round((movie.vote_average || 0) * 10)}% Match`;
    document.getElementById('modal-year').textContent = (movie.release_date || movie.first_air_date || '').split('-')[0];
    document.getElementById('modal-runtime').textContent = details?.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : '';
    document.getElementById('modal-overview').textContent = movie.overview || 'No description available.';
    document.getElementById('modal-rating').textContent = (movie.vote_average || 0).toFixed(1) + '/10';
    document.getElementById('modal-language').textContent = (movie.original_language || 'en').toUpperCase();

    // Genres
    const genres = details?.genres?.map(g => g.name) || getGenreNames(movie.genre_ids);
    document.getElementById('modal-genres').textContent = genres.join(', ');

    // My List button
    const addBtn = document.getElementById('modal-add-list');
    const isInList = myList.some(m => m.id === movie.id);
    addBtn.classList.toggle('added', isInList);
    addBtn.innerHTML = isInList
        ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    addBtn.onclick = () => {
        toggleMyList(movie);
        const nowInList = myList.some(m => m.id === movie.id);
        addBtn.classList.toggle('added', nowInList);
        addBtn.innerHTML = nowInList
            ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    };

    // Play button in modal
    document.getElementById('modal-play-btn').onclick = () => playMovie(movie);

    // Similar movies
    const similarGrid = document.getElementById('similar-grid');
    similarGrid.innerHTML = '';
    const similar = details?.similar?.results?.slice(0, 9) || [];
    similar.forEach(sim => {
        if (!sim.backdrop_path && !sim.poster_path) return;
        const card = document.createElement('div');
        card.className = 'similar-card';
        const simYear = (sim.release_date || sim.first_air_date || '').split('-')[0];
        const simRating = Math.round((sim.vote_average || 0) * 10);
        card.innerHTML = `
            <img class="similar-card-img" src="${imgUrl(sim.backdrop_path || sim.poster_path, 'card')}" alt="${sim.title || sim.name}" loading="lazy">
            <div class="similar-card-body">
                <div class="similar-card-meta">
                    <span class="card-match">${simRating}%</span>
                    <span>${simYear}</span>
                </div>
                <p class="similar-card-overview">${sim.overview || 'No description available.'}</p>
            </div>
        `;
        card.addEventListener('click', () => {
            closeModal();
            setTimeout(() => openModal(sim), 350);
        });
        similarGrid.appendChild(card);
    });

    // Trailer
    const trailerSection = document.getElementById('modal-trailer-section');
    const trailerContainer = document.getElementById('trailer-container');
    trailerContainer.innerHTML = '';

    const videos = details?.videos?.results || [];
    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube')
        || videos.find(v => v.site === 'YouTube');

    if (trailer) {
        trailerSection.style.display = 'block';
        trailerContainer.innerHTML = `
            <iframe src="https://www.youtube.com/embed/${trailer.key}?rel=0&modestbranding=1" 
                    title="${trailer.name}" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen></iframe>
        `;
    } else {
        trailerSection.style.display = 'none';
    }

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('movie-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Stop trailer
    const trailerContainer = document.getElementById('trailer-container');
    trailerContainer.innerHTML = '';
}

// ===== VIDEO PLAYER =====
async function playMovie(movie) {
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');

    // Fetch videos
    const data = await tmdbFetch(`/${mediaType}/${movie.id}/videos`);
    const videos = data?.results || [];
    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube')
        || videos.find(v => v.site === 'YouTube');

    if (trailer) {
        openVideoPlayer(trailer.key, movie.title || movie.name);
    } else {
        showToast('⚠️', `No trailer available for "${movie.title || movie.name}"`);
    }
}

function openVideoPlayer(youtubeId, title) {
    const modal = document.getElementById('video-player-modal');
    const container = document.getElementById('video-player-container');

    container.innerHTML = `
        <iframe src="https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1" 
                title="${title}" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen></iframe>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeVideoPlayer() {
    const modal = document.getElementById('video-player-modal');
    const container = document.getElementById('video-player-container');

    modal.classList.remove('active');
    container.innerHTML = '';
    document.body.style.overflow = '';
}

// ===== SEARCH =====
async function performSearch(query) {
    const data = await tmdbFetch('/search/multi', { query, page: 1 });
    if (!data?.results) return;

    const results = data.results.filter(r => r.media_type !== 'person' && (r.backdrop_path || r.poster_path));
    renderSearchResults(results, query);
}

function renderSearchResults(results, query) {
    const overlay = document.getElementById('search-results-overlay');
    const grid = document.getElementById('search-results-grid');
    const display = document.getElementById('search-query-display');

    display.textContent = query;
    grid.innerHTML = '';

    if (results.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <h3>No results found for "${query}"</h3>
                <p>Try searching with a different term</p>
            </div>
        `;
    } else {
        results.forEach(item => {
            const card = document.createElement('div');
            card.className = 'search-result-card';
            card.innerHTML = `
                <img src="${imgUrl(item.backdrop_path || item.poster_path, 'card')}" 
                     alt="${item.title || item.name}" loading="lazy">
                <div class="card-title">${item.title || item.name}</div>
            `;
            card.addEventListener('click', () => openModal(item));
            grid.appendChild(card);
        });
    }

    overlay.classList.add('active');
}

function hideSearchResults() {
    document.getElementById('search-results-overlay').classList.remove('active');
}

// ===== MY LIST =====
function toggleMyList(movie) {
    const index = myList.findIndex(m => m.id === movie.id);
    if (index > -1) {
        myList.splice(index, 1);
        showToast('➖', `Removed "${movie.title || movie.name}" from your list`);
    } else {
        myList.push({
            id: movie.id,
            title: movie.title,
            name: movie.name,
            backdrop_path: movie.backdrop_path,
            poster_path: movie.poster_path,
            overview: movie.overview,
            vote_average: movie.vote_average,
            genre_ids: movie.genre_ids,
            release_date: movie.release_date,
            first_air_date: movie.first_air_date,
            media_type: movie.media_type || (movie.first_air_date ? 'tv' : 'movie'),
            original_language: movie.original_language
        });
        showToast('✅', `Added "${movie.title || movie.name}" to your list`);
    }
    localStorage.setItem('netflix_mylist', JSON.stringify(myList));
}

// ===== TOAST NOTIFICATIONS =====
function showToast(icon, message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== MODAL EVENT LISTENERS =====
function initModalListeners() {
    document.getElementById('modal-overlay').addEventListener('click', closeModal);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('video-player-overlay').addEventListener('click', closeVideoPlayer);
    document.getElementById('video-close').addEventListener('click', closeVideoPlayer);
}

// ===== INITIALIZE APP =====
async function init() {
    hideSplash();
    initNavbar();
    initModalListeners();

    // Load genres first
    await fetchGenres();

    // Load hero and rows
    await loadHeroBanner();
    await switchSection('home');

    // Auto-rotate hero every 15s
    setInterval(async () => {
        const data = await tmdbFetch('/trending/movie/week');
        if (data?.results?.length) {
            const candidates = data.results.filter(m => m.backdrop_path && m.id !== heroMovie?.id);
            heroMovie = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];

            const heroBg = document.getElementById('hero-bg');
            heroBg.style.opacity = '0';
            setTimeout(() => {
                renderHero(heroMovie);
                heroBg.style.opacity = '1';
            }, 500);
        }
    }, 15000);
}

// Run
document.addEventListener('DOMContentLoaded', init);
