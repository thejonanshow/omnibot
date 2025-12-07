export default {
  async fetch(request) {
    const response = await fetch(request);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const successButtons = doc.querySelectorAll('button.success');
    successButtons.forEach(button => {
      button.style.backgroundColor = 'cornflowerblue';
    });
    return new Response(doc.documentElement.outerHTML, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  },
};