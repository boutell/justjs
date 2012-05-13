/*
Copyright (c) 2003-2012, CKSource - Frederico Knabben. All rights reserved.
For licensing, see LICENSE.html or http://ckeditor.com/license
*/

CKEDITOR.editorConfig = function( config )
{
	// Force English so we can distribute a minimum of files. You can replace this
	// with a full install of ckeditor anytime and remove this line
	config.language = 'en';

	config.toolbar = 'blog';
	CKEDITOR.stylesSet.add('blog',
	[
	    { name : 'Paragraph', element : 'p', styles : {} },
	    { name : 'Heading', element : 'h3', styles : {} },
	    { name : 'Source Code' , element : 'pre', styles : {} }
	]);
	config.stylesSet = 'blog';
	config.toolbar_blog = [ 
		{ name: 'styles', items : [ 'Styles' ] }, 
		{ name: 'basic', items: ['Bold', 'Italic', '-', 'NumberedList', 'BulletedList', '-', 'Link', 'Unlink'] } ];
};
