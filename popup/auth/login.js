document.addEventListener('click', (event) => {
  // Listener for "Load Signup"
  if (event.target && event.target.id === 'load-signup') {
    console.log('Loading signup page...');
    loadFeature('signup'); // Dynamically load the signup feature
  }

  // Listener for "Load Login"
  if (event.target && event.target.id === 'load-login') {
    console.log('Loading login page...');
    loadFeature('login'); // Dynamically load the login feature
  }
});
