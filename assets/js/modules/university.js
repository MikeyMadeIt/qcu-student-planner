/* ============================================================
   UNIVERSITY.JS — Quezon City University
   ============================================================ */

const university = {
    name: 'Quezon City University',
    tagline: 'Nurturing Minds, Transforming Lives, Building the Nation',
    established: '1988',
    campus: 'Batasan Campus (Main)',
    address: 'Batasan Compound, Constitution Hills, Quezon City, Metro Manila 1126',
    website: 'https://www.qcu.edu.ph',
    email: 'info@qcu.edu.ph',
    phone: '(02) 8988-4242',
    hours: 'Monday – Friday, 8:00 AM – 5:00 PM',
    type: 'Local University',
    vision: 'To be an internationally recognized local university committed to innovation and sustainability to achieve positive social impact.',
    mission: 'To provide a comprehensive education that enhances the lives of QCU students for nation-building and as world citizens.',
    strategicDirections: [
        {
            label: 'Excellence in Curricular Innovation',
            desc: 'We will offer relevant academic programs that engage students and professionals in interdisciplinary education that inspires analytic thinking, creativity, and ethical practices through experiential learning. Thus, preparing them to the industry 4.0 ready.',
        },
        {
            label: 'Faculty Excellence',
            desc: 'We are committed to supporting and strengthening faculty through the recruitment, development, and retention of outstanding scholars and educators. We will promote academic leaders\' growth through professional development opportunities and institutional policies designed to strengthen our faculty towards discovery, learning, and engagement. We believe a great university is built by great faculty.',
        },
        {
            label: 'Student Excellence',
            desc: 'Student success is the core function of QCU. It is our students\' success that fuels our passion for serving in the profession of higher education. Students succeed when we devote our energies to continuously improving their experiences in and out of the classroom. We will make data-informed decisions in our ongoing effort to fuel new opportunities for our student\'s academic achievement and well-being. We will demonstrate our commitment to our student\'s success through innovative engagement efforts that begin before arrival and continue after graduation.',
        },
        {
            label: 'Excellence in Research',
            desc: 'Research excellence encompasses a broad vision of accomplishment. QCU aims to become a research powerhouse, a leading university for research across many fields amongst local universities and colleges in the country. Our research should have a profound impact on several areas of society. Achieving it requires both disciplinary depth and collaboration within and across disciplines and communities. It also necessitates resources for research services that enable researchers to achieve excellence in a highly competitive landscape. Research might lead to spinoffs that take advantage of technological developments. Still, the impact is also to be found in projects that lead to social innovations that inform our understanding of history or enrich our world through creative works.',
        },
        {
            label: 'Excellence in Community Engagement',
            desc: 'Extension service or community engagement is one of the University\'s triadic functions. QCU will create a culture of outreach and engagement through innovative teaching and scholarship and value engagement with our communities and local partners. By applying our academic and professional expertise to community stakeholders\' collaborations, we will improve the quality of life of the communities we serve.',
        },
        {
            label: 'Excellence in Institutional Governance',
            desc: 'Good governance will be applied and practiced in the University. Stakeholders have a voice in decision-making, either directly or through legitimate intermediate institutions that represent their interests. Participation and consensus orientation will be valued. The administration will ensure that the entire community/stakeholders\' needs are served while balancing competing interests in a timely, appropriate and responsive manner.',
        },
        {
            label: 'Excellent Campus Environment',
            desc: 'QCU, with the city government\'s support, is committed to transforming and revitalizing the campus by securing investment in teaching and learning facilities. Campus revitalization involves a significant capital investment. At the core of this revitalization will be the construction of additional facilities and buildings for the community\'s intellectual, social, physical and spiritual needs.',
        },
    ],
    sharedValues: {
        acronym: 'J.O.Y.',
        full: 'Jointness of undertakings and Organizational adaptability with a Yoke of efficiency and effectiveness.',
        breakdown: [
            { letter: 'J', highlight: 'J', rest: 'ointness of undertakings and' },
            { letter: 'O', highlight: 'O', rest: 'rganizational adaptability with' },
            { letter: 'Y', highlight: 'Y', rest: 'oke of efficiency and effectiveness.' },
        ],
    },
    hymn: {
        title: 'Quezon City University Hymn',
        lyrics: `Dakila kang humubog ng dangal
Dalisay na gabay sa pag aaral
Tagumpay laging ipinagdarasal
QCU naming pinakamamahal

Sa pagsibol ng aming pagkatao
Bigyang liwanag at kulay ang mundo
Tahanan ka ng husay at talino
Taglay ang pangarap ng Pilipino

Pinagpalang Quezon City University
Pangalan ay laging aalagaan
Natatanging Quezon City University
Sandigan ng aming kinabukasan
Pinagpalang Quezon City University
Pangalan ay laging aalagaan
Natatanging Quezon City University
Sandigan ng aming kinabukasan

Natatanging Quezon City University
Sandigan ng aming kinabukasan`,
        credit: '— Official Himno ng Quezon City University',
    },
    campuses: [
        {
            name: 'San Bartolome Campus',
            note: 'Main Campus',
            address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City',
            hours: 'Monday – Friday, 8:00 AM – 5:00 PM',
            image: '../../assets/images/campuses/san-bartolome-campus.jpeg',
        },
        {
            name: 'San Francisco Campus',
            note: '',
            address: 'Bago Bantay, Quezon City, Metro Manila',
            hours: 'Monday – Friday, 8:00 AM – 5:00 PM',
            image: '../../assets/images/campuses/san-francisco-campus.jpeg',
        },
        {
            name: 'Batasan Campus',
            note: '',
            address: 'Batasan Rd, Quezon City, Metro Manila',
            hours: 'Monday – Friday, 8:00 AM – 5:00 PM',
            image: '../../assets/images/campuses/batasan-campus.jpeg',
        },
    ],
    colleges: [
        {
            name: 'College of Accountancy',
            abbr: 'COA',
            logo: '../../assets/images/colleges/college-of-accountancy.png',
            desc: 'The College of Accountancy aims to produce globally competitive professional accountants instilled with the highest ideals of moral and ethical standards. It prepares graduates to honor God, respect others, and dignify oneself through the discipline of accounting.',
            courses: [
                { code: 'BSA', title: 'Bachelor of Science in Accountancy' },
            ],
        },
        {
            name: 'College of Business Administration',
            abbr: 'CBA',
            logo: '../../assets/images/colleges/college-of-business.png',
            desc: 'The College of Business Administration equips students with knowledge, skills, and values needed to become responsible entrepreneurs and effective business leaders in the local and global marketplace.',
            courses: [
                { code: 'BS Entrep', title: 'Bachelor of Science in Entrepreneurship' },
                { code: 'BSBA-MM', title: 'BSBA Major in Marketing Management' },
                { code: 'BSBA-FM', title: 'BSBA Major in Financial Management' },
                { code: 'BSBA-HRM', title: 'BSBA Major in Human Resource Management' },
                { code: 'BSBA-OM', title: 'BSBA Major in Operations Management' },
            ],
        },
        {
            name: 'College of Computer Studies',
            abbr: 'CCS',
            logo: '../../assets/images/colleges/college-of-computer-studies.png',
            desc: 'The College of Computer Studies covers the study and application of hardware and software technologies including planning, installing, customizing, operating, managing, and maintaining IT infrastructure that provides computing solutions to address organizational needs.',
            courses: [
                { code: 'BSCS', title: 'Bachelor of Science in Computer Science' },
                { code: 'BSIT', title: 'Bachelor of Science in Information Technology' },
            ],
        },
        {
            name: 'College of Engineering',
            abbr: 'COE',
            logo: '../../assets/images/colleges/college-of-engineering.png',
            desc: 'The College of Engineering adopts an outcomes-based curriculum as prescribed by CHED (CMO No. 101, s. 2018 and CMO No. 96, s. 2017), preparing graduates who are technically competent, professionally ethical, and ready for the demands of modern industry.',
            courses: [
                { code: 'BSIE', title: 'Bachelor of Science in Industrial Engineering' },
                { code: 'BSECE', title: 'Bachelor of Science in Electronics Engineering' },
            ],
        },
        {
            name: 'College of Education',
            abbr: 'CEd',
            logo: '../../assets/images/colleges/college-of-education.png',
            desc: 'The College of Education is a premier teacher-education center providing quality instruction and training for future educators, preparing them to serve public schools in Quezon City and the National Capital Region in general.',
            courses: [
                { code: 'BECEd', title: 'Bachelor of Early Childhood Education' },
                { code: 'BEEd', title: 'Bachelor of Elementary Education' },
                { code: 'BSEd-Eng', title: 'BSEd Major in English' },
                { code: 'BSEd-Math', 'title': 'BSEd Major in Mathematics' },
                { code: 'BSEd-Sci', title: 'BSEd Major in Science' },
                { code: 'BSEd-Fil', title: 'BSEd Major in Filipino' },
            ],
        },
    ],
    directory: [
        {
            office: 'Office of the University President',
            icon: 'bi-person-badge-fill',
            divisions: [
                { name: 'Office of the University President', officer: 'Dr. Theresita V. Atienza', position: 'University President', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'opresident@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Quality Assurance Office', officer: 'Director', position: 'Director, Quality Assurance', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'qao@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Internal Audit Office', officer: 'Internal Auditor', position: 'Chief Internal Auditor', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'iao@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Legal Office', officer: 'Legal Officer', position: 'University Legal Counsel', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'legal@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Public Information Office', officer: 'Information Officer', position: 'Public Information Officer', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'pio@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
            ],
        },
        {
            office: 'Office of the VP for Research, Extension, Planning & Linkages',
            icon: 'bi-lightbulb-fill',
            divisions: [
                { name: 'Office of the VP for REPL', officer: 'Vice President', position: 'VP for Research, Extension, Planning & Linkages', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'vprepl@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Research and Development Center', officer: 'Research Director', position: 'Director, Research and Development', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'rdc@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Extension and Community Services', officer: 'Extension Director', position: 'Director, Extension Services', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'extension@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Planning and Development Office', officer: 'Planning Officer', position: 'Director, Planning and Development', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'planning@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Linkages and International Affairs', officer: 'Linkages Director', position: 'Director, Linkages and International Affairs', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'linkages@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
            ],
        },
        {
            office: 'Office of the VP for Administration & Finance',
            icon: 'bi-briefcase-fill',
            divisions: [
                { name: 'Office of the VP for Admin & Finance', officer: 'Vice President', position: 'VP for Administration and Finance', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'vpaf@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Accounting Office', officer: 'Chief Accountant', position: 'Chief Accountant', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'accounting@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: "Cashier's Office", officer: 'University Cashier', position: 'University Cashier', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'cashier@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Human Resource Management Office', officer: 'HRMO', position: 'Human Resource Management Officer', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'hrmo@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Supply and Property Management Office', officer: 'Supply Officer', position: 'Supply and Property Management Officer', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'supply@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'General Services Office', officer: 'GSO Head', position: 'General Services Officer', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'gso@qcu.edu.ph', hours: 'Mon–Fri, 7:00 AM – 5:00 PM' },
                { name: 'Security Services', officer: 'Chief Security Officer', position: 'Chief Security Officer', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: '', hours: '24/7' },
            ],
        },
        {
            office: 'Office of the VP for Academic Affairs',
            icon: 'bi-journal-bookmark-fill',
            divisions: [
                { name: 'Office of the VP for Academic Affairs', officer: 'Vice President', position: 'VP for Academic Affairs', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'vpaa@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Office of the University Registrar', officer: 'University Registrar', position: 'University Registrar', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'registrar@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Office of Student Affairs & Services', officer: 'Director, OSAS', position: 'Director for Student Affairs and Services', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'osas@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Guidance and Counseling Center', officer: 'Guidance Counselor', position: 'University Guidance Counselor', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'guidance@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Scholarship Office', officer: 'Scholarship Coordinator', position: 'Scholarship Coordinator', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'scholarship@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Admissions Office', officer: 'Admissions Officer', position: 'Admissions Officer', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'admissions@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'University Library', officer: 'University Librarian', position: 'University Librarian', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'library@qcu.edu.ph', hours: 'Mon–Fri, 7:30 AM – 6:00 PM' },
                { name: 'University Clinic / Health Services', officer: 'University Physician', position: 'University Physician / Nurse-in-Charge', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'clinic@qcu.edu.ph', hours: 'Mon–Fri, 7:30 AM – 5:00 PM' },
                { name: 'ICT Office', officer: 'ICT Director', position: 'ICT Director', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'ict@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
                { name: 'Alumni Affairs Office', officer: 'Alumni Affairs Officer', position: 'Alumni Affairs Officer', address: '673 Quirino Highway, San Bartolome, Novaliches, Quezon City', phone: '(02) 8806-3049', email: 'alumni@qcu.edu.ph', hours: 'Mon–Fri, 8:00 AM – 5:00 PM' },
            ],
        },
    ],
    studentResources: [
        { title: 'Student Manual', icon: 'bi-book-half', desc: 'Official QCU student policies, rights, responsibilities, and code of conduct.', type: 'link', url: 'https://www.qcu.edu.ph/student-manual.pdf', label: 'View Manual' },
        { title: 'Academic Calendar', icon: 'bi-calendar3', desc: 'Current academic year schedule, key dates, holidays, and enrollment periods.', type: 'internal', url: 'calendar.html', label: 'Open Calendar' },
        { title: 'More resources coming soon', icon: 'bi-hourglass-split', desc: 'Additional student resources and links will be added here.', type: 'soon', url: '', label: '' },
    ],
};

/* ============================================================
   UTILITIES
   ============================================================ */

function copyText(text, label) {
    navigator.clipboard.writeText(text).then(() => showToast(`${label || 'Copied'}!`, 'bi-clipboard-check'))
        .catch(() => showToast('Could not copy.', 'bi-exclamation-circle'));
}

function showToast(msg, icon = 'bi-info-circle') {
    let stack = document.getElementById('univToastStack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'univToastStack';
        stack.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        stack.style.zIndex = 9999;
        document.body.appendChild(stack);
    }
    const id = 'ut' + Date.now();
    stack.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="toast align-items-center border-0 univ-toast" role="alert">
      <div class="d-flex align-items-center gap-2 px-3 py-2">
        <i class="bi ${icon}" style="color:rgb(var(--accent))"></i>
        <span style="font-size:.85rem;font-weight:600">${msg}</span>
        <button type="button" class="btn-close ms-auto btn-close-white" data-bs-dismiss="toast"></button>
      </div>
    </div>`);
    const el = document.getElementById(id);
    new bootstrap.Toast(el, { delay: 2000 }).show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
}

/* ============================================================
   TAB SYSTEM
   ============================================================ */

const TABS = ['about', 'directory', 'student'];

function switchTab(key) {
    TABS.forEach(t => {
        document.getElementById('tab-' + t)?.classList.toggle('univ-tab-active', t === key);
        document.getElementById('panel-' + t)?.classList.toggle('d-none', t !== key);
    });
    if (key === 'directory') {
        const c = document.getElementById('dirContainer');
        if (c && !c.dataset.rendered) {
            renderDirectory();
            c.dataset.rendered = '1';
        }
    }
    history.replaceState(null, '', '#' + key);
}

/* ============================================================
   RENDER: ABOUT
   ============================================================ */

function renderAbout() {
    const infoRows = [
        { icon: 'bi-geo-alt-fill', label: 'Address', val: university.address },
        { icon: 'bi-globe2', label: 'Website', val: `<a href="${university.website}" target="_blank" class="univ-link">${university.website}</a>` },
        { icon: 'bi-envelope-fill', label: 'Email', val: `<a href="mailto:${university.email}" class="univ-link">${university.email}</a>` },
        { icon: 'bi-telephone-fill', label: 'Phone', val: `<a href="tel:${university.phone.replace(/\D/g, '')}" class="univ-link">${university.phone}</a>` },
        { icon: 'bi-clock-fill', label: 'Hours', val: university.hours },
        { icon: 'bi-calendar-fill', label: 'Est.', val: university.established },
    ];
    const visionPoints = [
        { n: '01', title: 'Internationally Recognized', desc: 'Strong global partnerships, international accreditation, and globally relevant research.' },
        { n: '02', title: 'Sustainability-Driven', desc: 'Programs and research aligned with the Sustainable Development Goals (SDGs).' },
        { n: '03', title: 'Foster Innovation', desc: 'Integrate cutting-edge technologies and creative solutions into curriculum and strategy.' },
        { n: '04', title: 'Social Impact', desc: 'Active community development, knowledge-sharing, and societal upliftment.' },
    ];
    const visionPointsHtml = visionPoints.map((p, i) => `
    <div class="accordion-item ua-item">
      <h2 class="accordion-header">
        <button class="accordion-button ua-btn collapsed" type="button"
                data-bs-toggle="collapse" data-bs-target="#vp${i}" data-bs-parent="#visionPointsAcc">
          <span class="ua-num">${p.n}</span>
          <span class="ua-btn-title">${p.title}</span>
        </button>
      </h2>
      <div id="vp${i}" class="accordion-collapse collapse">
        <div class="ua-body">${p.desc}</div>
      </div>
    </div>`).join('');
    const sdHtml = university.strategicDirections.map((d, i) => `
    <div class="accordion-item ua-item">
      <h2 class="accordion-header">
        <button class="accordion-button ua-btn collapsed" type="button"
                data-bs-toggle="collapse" data-bs-target="#sd${i}" data-bs-parent="#sdAcc">
          <span class="ua-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="ua-btn-title">${d.label}</span>
        </button>
      </h2>
      <div id="sd${i}" class="accordion-collapse collapse">
        <div class="ua-body">${d.desc}</div>
      </div>
    </div>`).join('');
    const joyHtml = university.sharedValues.breakdown.map(v => `
    <div class="ua-joy-row">
      <span class="ua-joy-letter">${v.letter}</span>
      <span class="ua-joy-text"><span class="ua-joy-hl">${v.highlight}</span><span class="ua-joy-rest">${v.rest}</span></span>
    </div>`).join('');
    const collegeHtml = university.colleges.map((col, ci) => `
    <div class="accordion-item ua-item">
      <h2 class="accordion-header">
        <button class="accordion-button ua-btn collapsed" type="button"
                data-bs-toggle="collapse" data-bs-target="#col${ci}" data-bs-parent="#collegesAcc">
          <img src="${col.logo}" alt="${col.abbr}" class="ua-college-logo">
          <span class="ua-btn-title">${col.name}</span>
          <span class="ua-abbr ms-auto me-1">${col.abbr}</span>
        </button>
      </h2>
      <div id="col${ci}" class="accordion-collapse collapse">
        <div class="ua-body">
          <p class="ua-desc mb-2">${col.desc}</p>
          <div class="ua-courses">
            ${col.courses.map(c => `
              <div class="ua-course-row">
                <span class="cur-code mono">${c.code}</span>
                <span class="ua-course-title">${c.title}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`).join('');
    const campusHtml = university.campuses.map(c => `
    <div class="col-md-4">
      <div class="ua-campus-card h-100">
        <img src="${c.image}" alt="${c.name}" class="ua-campus-img">
        <div class="ua-campus-info">
          <div class="ua-campus-name">
            ${c.name}
            ${c.note ? `<span class="chip chip-sm ms-1" style="font-size:.6rem">${c.note}</span>` : ''}
          </div>
          <div class="ua-detail-list mt-1">
            <div class="ua-detail"><i class="bi bi-geo-alt-fill"></i><span>${c.address}</span></div>
            <div class="ua-detail"><i class="bi bi-clock-fill"></i><span>${c.hours}</span></div>
          </div>
        </div>
      </div>
    </div>`).join('');
    document.getElementById('panel-about').innerHTML = `

    <!-- ── General Information ── -->
    <div class="ua-section-label mb-2"><i class="bi bi-building me-1"></i>General Information</div>
    <div class="ua-glass-card mb-3">
      <div class="ua-info-banner">
        <div class="ua-info-main">
          <div class="d-flex align-items-center gap-3 mb-2">
            <img src="../../assets/images/branding/qcu-logo.webp" alt="QCU Seal" class="ua-seal">
            <div>
              <div class="ua-uni-name">${university.name}</div>
              <div class="ua-uni-tag">${university.tagline}</div>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <span class="chip"><i class="bi bi-geo-alt-fill me-1"></i>Quezon City</span>
            <span class="chip"><i class="bi bi-calendar-fill me-1"></i>Est. ${university.established}</span>
            <span class="chip"><i class="bi bi-mortarboard-fill me-1"></i>${university.type}</span>
          </div>
        </div>
        <div class="ua-info-rows">
          ${infoRows.map(r => `
            <div class="ua-info-row">
              <i class="bi ${r.icon} ua-info-icon"></i>
              <span class="ua-info-lbl">${r.label}</span>
              <span class="ua-info-val">${r.val}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- ── Vision & Mission ── -->
    <div class="ua-section-label mb-2"><i class="bi bi-eye-fill me-1"></i>Vision &amp; Mission</div>
    <div class="ua-glass-card mb-3" style="overflow:hidden">
      <img src="../../assets/images/branding/qcu-vision-mission.jpeg" alt="QCU Vision and Mission" class="ua-vm-img">
      <div class="ua-card-pad">
        <div class="ua-inner-label"><i class="bi bi-eye-fill me-1"></i>Vision</div>
        <p class="ua-quote">"${university.vision}"</p>
        <div class="accordion ua-inner-acc" id="visionPointsAcc">${visionPointsHtml}</div>
        <div class="ua-inner-divider"></div>
        <div class="ua-inner-label"><i class="bi bi-flag-fill me-1"></i>Mission</div>
        <p class="ua-quote mb-2">"${university.mission}"</p>
        <p class="ua-faint">Aligned with QCU's strategic goals of sustainability, innovation, and social impact — Institutional Development Plan 2026–2031.</p>
      </div>
    </div>

    <!-- ── Strategic Directions ── -->
    <div class="ua-section-label mb-2"><i class="bi bi-compass-fill me-1"></i>Strategic Directions</div>
    <div class="ua-glass-card mb-3" style="overflow:hidden">
      <div class="ua-card-pad" style="border-bottom:1px solid var(--border)">
        <p class="ua-faint mb-0">QCU directs its core functions — instruction, research, extension, and production — toward nation-building and producing world citizens.</p>
      </div>
      <div class="accordion ua-inner-acc ua-no-top-border" id="sdAcc">${sdHtml}</div>
    </div>

    <!-- ── Shared Values ── -->
    <div class="ua-section-label mb-2"><i class="bi bi-heart-fill me-1"></i>Shared Values</div>
    <div class="ua-glass-card mb-3">
      <div class="ua-card-pad">
        <p class="ua-faint mb-3">"${university.sharedValues.full}"</p>
        <div class="d-flex flex-column">${joyHtml}</div>
      </div>
    </div>

    <!-- ── University Hymn ── -->
    <div class="ua-section-label mb-2"><i class="bi bi-music-note-beamed me-1"></i>University Hymn</div>
    <div class="ua-glass-card mb-3">
      <div class="ua-card-pad">
        <div class="ua-hymn-title mb-2">${university.hymn.title}</div>
        <pre class="ua-hymn-pre">${university.hymn.lyrics}</pre>
        <div class="ua-hymn-credit">${university.hymn.credit}</div>
        <button class="btn btn-ghost btn-sm mt-2 d-flex align-items-center gap-2"
                onclick="copyText(university.hymn.lyrics + '\n' + university.hymn.credit, 'Lyrics copied')">
          <i class="bi bi-clipboard"></i> Copy Lyrics
        </button>
      </div>
    </div>

    <!-- ── Campuses ── -->
    <div class="ua-section-label mb-2"><i class="bi bi-buildings-fill me-1"></i>Campuses</div>
    <div class="row g-2 mb-3">${campusHtml}</div>

    <!-- ── Academic ── -->
    <div class="ua-section-label mb-2"><i class="bi bi-mortarboard-fill me-1"></i>Academic</div>
    <div class="ua-glass-card" style="overflow:hidden">
      <div class="ua-academic-head">
        <div class="ua-academic-title">The Colleges and Courses Offered</div>
        <div class="ua-faint mt-1">Five colleges offering quality undergraduate programs committed to excellence and community service.</div>
      </div>
      <div class="accordion ua-inner-acc ua-no-top-border" id="collegesAcc">${collegeHtml}</div>
    </div>`;
}

/* ============================================================
   RENDER: DIRECTORY
   ============================================================ */

function renderDirectory(query) {
    const q = (query || document.getElementById('dirSearch')?.value || '').toLowerCase().trim();
    let html = '';
    university.directory.forEach((group, gi) => {
        let divHtml = '';
        let vis = 0;
        group.divisions.forEach((div, di) => {
            const text = [group.office, div.name, div.officer, div.position, div.email, div.phone, div.address].join(' ').toLowerCase();
            if (q && !text.includes(q))
                return;
            vis++;
            const hasEmail = !!div.email;
            const hasPhone = !!div.phone;
            divHtml += `
        <div class="ua-div-row ${di > 0 ? 'ua-div-row-border' : ''}">
          <div class="ua-div-row-main">
            <div class="ua-div-name">${div.name}</div>
            <div class="ua-div-officer">
              <i class="bi bi-person-fill"></i>${div.officer}
              <span class="ua-div-pos">· ${div.position}</span>
            </div>
            <div class="ua-div-meta">
              <span><i class="bi bi-clock-fill"></i>${div.hours}</span>
              ${hasPhone ? `<span><i class="bi bi-telephone-fill"></i>${div.phone}</span>` : ''}
              ${hasEmail ? `<span class="ua-div-email-text"><i class="bi bi-envelope-fill"></i>${div.email}</span>` : ''}
            </div>
          </div>
          <div class="ua-div-row-actions">
            ${hasPhone ? `
              <a href="tel:${div.phone.replace(/\D/g, '')}" class="ua-icon-btn" title="Call">
                <i class="bi bi-telephone-fill"></i>
              </a>` : ''}
            ${hasEmail ? `
              <a href="mailto:${div.email}" class="ua-icon-btn" title="Email">
                <i class="bi bi-envelope-fill"></i>
              </a>
              <button class="ua-icon-btn" title="Copy email" onclick="copyText('${div.email}','Email copied')">
                <i class="bi bi-clipboard"></i>
              </button>` : ''}
          </div>
        </div>`;
        });
        if (q && vis === 0)
            return;
        html += `
      <div class="ua-glass-card mb-3">
        <div class="ua-dir-group-head">
          <div class="ua-dir-group-icon"><i class="bi ${group.icon}"></i></div>
          <div class="flex-1">
            <div class="ua-dir-group-name">${group.office}</div>
            <div class="ua-faint" style="font-size:.7rem;margin-top:1px">${group.divisions.length} office${group.divisions.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        ${divHtml || `<div class="ua-card-pad ua-faint" style="font-size:.81rem">No matches</div>`}
      </div>`;
    });
    if (!html) {
        html = `<div class="ua-no-results"><i class="bi bi-search"></i><p>No offices match "<strong>${q}</strong>"</p></div>`;
    }
    document.getElementById('dirContainer').innerHTML = html;
}

/* ============================================================
   RENDER: STUDENT
   ============================================================ */

function renderStudent() {
    document.getElementById('panel-student').innerHTML = `
    <div class="ua-section-label mb-2"><i class="bi bi-mortarboard-fill me-1"></i>Student Resources</div>
    <div class="ua-glass-card" style="overflow:hidden">
      ${university.studentResources.map((r, i) => `
        <div class="ua-resource-row ${i > 0 ? 'ua-div-border' : ''} ${r.type === 'soon' ? 'ua-resource-soon' : ''}">
          <div class="ua-resource-icon"><i class="bi ${r.icon}"></i></div>
          <div class="ua-resource-info">
            <div class="ua-resource-title">${r.title}</div>
            <div class="ua-faint" style="font-size:.77rem;margin-top:2px">${r.desc}</div>
          </div>
          ${r.type !== 'soon' ? `
            <a href="${r.url}" ${r.type === 'link' ? 'target="_blank" rel="noopener"' : ''}
               class="btn btn-ghost btn-sm ua-resource-btn ms-auto flex-shrink-0">
              <i class="bi ${r.type === 'link' ? 'bi-box-arrow-up-right' : 'bi-arrow-right-circle-fill'} me-1"></i>${r.label}
            </a>` : `<span class="ua-coming-soon ms-auto flex-shrink-0">Soon</span>`}
        </div>`).join('')}
    </div>`;
}

/* ============================================================
   INIT
   ============================================================ */

function initUniversity() {
    renderAbout();
    renderStudent();
    document.getElementById('dirSearch')?.addEventListener('input', e => {
        renderDirectory(e.target.value);
        document.getElementById('dirContainer').dataset.rendered = '1';
    });
    const hash = location.hash.replace('#', '');
    switchTab(TABS.includes(hash) ? hash : 'about');
}
