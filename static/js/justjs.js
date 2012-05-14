// All links with the 'confirm' class display a standard confirmation prompt,
// using the data-confirm attribute as the text of the prompt, and cancel the
// action of the link if the user does not confirm. This could be swapped out
// for a prettier in-context solution at any time

$('.confirm').click(function() {
	return confirm($(this).attr('data-confirm'));
});
